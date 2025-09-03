import { cachedQuery, batchQueries } from './db-optimized';
import { MySQLGirlProfile } from './girls';

// Optimized indexes for better query performance
const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_girl_age_display ON girl_profiles(age, is_displayed, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_shop_active ON shop_profiles(is_active, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_area_prefecture ON shop_profiles(area_prefecture_id);
  CREATE INDEX IF NOT EXISTS idx_girl_shop ON girl_profiles(shop_profile_id);
  CREATE INDEX IF NOT EXISTS idx_girl_height_weight ON girl_profiles(height, weight);
  CREATE INDEX IF NOT EXISTS idx_girl_status_types ON girl_status(girl_profile_id, girl_types_id);
  CREATE INDEX IF NOT EXISTS idx_girl_options ON girl_options(girl_profile_id, shop_option_id);
  CREATE INDEX IF NOT EXISTS idx_shop_options_name ON shop_options(name);
  CREATE INDEX IF NOT EXISTS idx_girl_types_name ON girl_types(name);
`;

/**
 * Optimized fetch with caching and parallel queries
 */
export async function fetchOptimizedGirls(
  limitCount: number = 200,
  offset: number = 0,
  area?: string | null,
  ageMin: number = 18,
  ageMax: number = 50,
  girlTypes?: string[] | null,
  girlId?: string | null,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null,
  recordingDuringPlay?: string | null,
  isSadist?: string | null,
  isMasochist?: string | null,
  partnerHeight?: string | null,
  partnerWeight?: string | null,
  partnerLocation?: string | null
): Promise<{ girls: MySQLGirlProfile[], total: number }> {
  // If girlId is specified, fetch only that specific girl
  if (girlId) {
    const girlQuery = `
      SELECT DISTINCT
        g.id,
        g.name,
        g.age,
        g.height,
        g.bust,
        g.waist,
        g.hip,
        g.cup,
        g.hobby,
        g.comment,
        g.shop_profile_id,
        g.is_displayed,
        s.name as shop_name,
        s.tel as shop_tel,
        s.latitude as shop_latitude,
        s.longitude as shop_longitude,
        IFNULL(p.name, '') as location,
        (
          SELECT GROUP_CONCAT(gt.name SEPARATOR ',')
          FROM girl_status gs
          INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
          WHERE gs.girl_profile_id = g.id
        ) as girl_types_json
      FROM girl_profiles g
      LEFT JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      WHERE g.id = ?
      LIMIT 1
    `;
    
    const girlResult = await cachedQuery(girlQuery, [parseInt(girlId)], `girl:${girlId}`, 3600);
    
    if (girlResult.length === 0) {
      return { girls: [], total: 0 };
    }
    
    // Fetch images for this girl
    const imageQuery = `
      SELECT girl_profile_id, real_image_url, image_url
      FROM girl_image_urls
      WHERE girl_profile_id = ?
      ORDER BY id ASC
      LIMIT 10
    `;
    
    const images = await cachedQuery(imageQuery, [parseInt(girlId)], `girl_images:${girlId}`, 3600);
    
    const girl = girlResult[0];
    girl.images = images.filter((img: any) => img.girl_profile_id === girl.id);
    
    return { girls: [girl], total: 1 };
  }
  
  // Generate cache key based on parameters
  const girlTypesStr = girlTypes ? girlTypes.sort().join(',') : '';
  const locationStr = userLat && userLng ? `${userLat.toFixed(2)}_${userLng.toFixed(2)}` : 'no_loc';
  const distStr = maxDistance ? `d${maxDistance}` : 'no_dist';
  const userPrefsStr = `${recordingDuringPlay || 'n'}:${isSadist || 'n'}:${isMasochist || 'n'}:${partnerHeight || 'n'}:${partnerWeight || 'n'}:${partnerLocation || 'n'}`;
  const cacheKey = `girls:${limitCount}:${offset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  const countCacheKey = `count:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  
  // Build optimized WHERE clause
  let whereConditions = [
    'g.is_displayed = 1',
    'g.deleted_at IS NULL',
    's.is_active = 1',
    's.deleted_at IS NULL',
    `(g.age IS NULL OR g.age BETWEEN ${ageMin} AND ${ageMax})`
  ];
  
  if (area && area !== 'all') {
    const escapedArea = area.replace(/'/g, "''");
    console.log('🔍 Searching for area:', area);
    console.log('🔍 Age range:', ageMin, '-', ageMax);
    console.log('🔍 Limit:', limitCount, 'Offset:', offset);
    
    // エリア名の正規化（都道府県名のみの場合と市区町村を含む場合に対応）
    const areaConditions = [];
    
    // 都道府県名の完全一致
    areaConditions.push(`p.name = '${escapedArea}'`);
    
    // 市区町村名での検索を追加
    areaConditions.push(`m.name = '${escapedArea}'`);
    
    // 都府県の接尾辞を柔軟に処理
    const suffixPattern = /[都府県]$/;
    if (suffixPattern.test(escapedArea)) {
      // 接尾辞を除いた形でも検索
      const withoutSuffix = escapedArea.replace(suffixPattern, '');
      areaConditions.push(`p.name LIKE '${withoutSuffix}%'`);
      // 接尾辞なしの完全一致も追加
      areaConditions.push(`p.name = '${withoutSuffix}'`);
    } else if (!escapedArea.match(/[区市町村]$/)) {
      // 市区町村の接尾辞がない、かつ都道府県の接尾辞もない場合のみ
      areaConditions.push(`p.name LIKE '${escapedArea}%'`);
      areaConditions.push(`p.name = '${escapedArea}都'`);
      areaConditions.push(`p.name = '${escapedArea}府'`);
      areaConditions.push(`p.name = '${escapedArea}県'`);
    }
    
    whereConditions.push(
      `(${areaConditions.join(' OR ')})`
    );
  }
  
  // Add girl types filtering if specified
  let girlTypesJoin = '';
  if (girlTypes && girlTypes.length > 0) {
    // Check if girlTypes are IDs (numbers) or names (strings)
    const isNumericIds = girlTypes.every(type => !isNaN(parseInt(type)));
    
    if (isNumericIds) {
      // If numeric IDs, use them directly
      const girlTypeIds = girlTypes.map(id => parseInt(id)).filter(id => !isNaN(id));
      if (girlTypeIds.length > 0) {
        girlTypesJoin = `
          INNER JOIN (
            SELECT DISTINCT girl_profile_id 
            FROM girl_status 
            WHERE girl_types_id IN (${girlTypeIds.join(',')})
          ) gs ON g.id = gs.girl_profile_id
        `;
      }
    } else {
      // If names, join with girl_types table to get IDs
      const escapedNames = girlTypes.map(name => `'${name.replace(/'/g, "''")}'`).join(',');
      girlTypesJoin = `
        INNER JOIN (
          SELECT DISTINCT gs.girl_profile_id 
          FROM girl_status gs
          INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
          WHERE gt.name IN (${escapedNames})
        ) gs ON g.id = gs.girl_profile_id
      `;
    }
  }
  
  // Add distance filtering if max distance specified
  if (maxDistance && userLat && userLng) {
    whereConditions.push(
      `ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(${userLng}, ${userLat})) / 1000 <= ${maxDistance}`
    );
  }
  
  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  
  // Build preference scoring query parts
  let preferenceScoreSelect = '';
  let preferenceJoins = '';
  let scoreComponents = [];
  
  // 撮影オプションのスコア
  if (recordingDuringPlay === 'はい') {
    preferenceJoins += `
      LEFT JOIN (
        SELECT DISTINCT go.girl_profile_id
        FROM girl_options go
        INNER JOIN shop_options so ON go.shop_option_id = so.id
        WHERE so.name LIKE '%撮影%' OR so.name LIKE '%動画%' OR so.name LIKE '%写真%'
      ) recording_opt ON g.id = recording_opt.girl_profile_id`;
    scoreComponents.push(`CASE WHEN recording_opt.girl_profile_id IS NOT NULL THEN 30 ELSE 0 END`);
  }
  
  // S/Mマッチング
  if (isSadist === 'はい') {
    // ユーザーがSの場合、ドMの女性を探す
    preferenceJoins += `
      LEFT JOIN (
        SELECT DISTINCT gs.girl_profile_id
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gt.name LIKE '%ドM%' OR gt.name LIKE '%M%'
      ) m_girls ON g.id = m_girls.girl_profile_id`;
    scoreComponents.push(`CASE WHEN m_girls.girl_profile_id IS NOT NULL THEN 50 ELSE 0 END`);
  } else if (isMasochist === 'はい') {
    // ユーザーがMの場合、ドSの女性を探す
    preferenceJoins += `
      LEFT JOIN (
        SELECT DISTINCT gs.girl_profile_id
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gt.name LIKE '%ドS%' OR gt.name LIKE '%S%'
      ) s_girls ON g.id = s_girls.girl_profile_id`;
    scoreComponents.push(`CASE WHEN s_girls.girl_profile_id IS NOT NULL THEN 50 ELSE 0 END`);
  }
  
  // 年齢スコア (年齢が範囲内なら20点、範囲から5歳以内なら10点)
  scoreComponents.push(`
    CASE 
      WHEN g.age IS NULL THEN 0
      WHEN g.age BETWEEN ${ageMin} AND ${ageMax} THEN 20
      WHEN g.age >= ${ageMin - 5} AND g.age <= ${ageMax + 5} THEN 10
      ELSE 0
    END`);
  
  // 身長スコア
  if (partnerHeight && partnerHeight !== 'こだわらない') {
    const heightMatch = partnerHeight.match(/(\d+).*[～~-].*(\d+)/);
    if (heightMatch) {
      const minHeight = parseInt(heightMatch[1]);
      const maxHeight = parseInt(heightMatch[2]);
      scoreComponents.push(`
        CASE 
          WHEN g.height BETWEEN ${minHeight} AND ${maxHeight} THEN 15
          WHEN ABS(g.height - ${minHeight}) <= 10 OR ABS(g.height - ${maxHeight}) <= 10 THEN 7
          ELSE 0
        END`);
    }
  }
  
  // 体重スコア
  if (partnerWeight && partnerWeight !== 'こだわらない') {
    if (partnerWeight.includes('以下')) {
      const match = partnerWeight.match(/(\d+)kg以下/);
      if (match) {
        const maxWeight = parseInt(match[1]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight <= ${maxWeight} THEN 15
            WHEN g.weight <= ${maxWeight + 5} THEN 7
            ELSE 0
          END`);
      }
    } else if (partnerWeight.includes('以上')) {
      const match = partnerWeight.match(/(\d+)kg以上/);
      if (match) {
        const minWeight = parseInt(match[1]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight >= ${minWeight} THEN 15
            WHEN g.weight >= ${minWeight - 5} THEN 7
            ELSE 0
          END`);
      }
    } else {
      const match = partnerWeight.match(/(\d+).*[～~-].*(\d+)/);
      if (match) {
        const minWeight = parseInt(match[1]);
        const maxWeight = parseInt(match[2]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight BETWEEN ${minWeight} AND ${maxWeight} THEN 15
            WHEN ABS(g.weight - ${minWeight}) <= 5 OR ABS(g.weight - ${maxWeight}) <= 5 THEN 7
            ELSE 0
          END`);
      }
    }
  }
  
  // 居住地スコア
  if (partnerLocation && partnerLocation !== 'こだわらない') {
    const escapedLocation = partnerLocation.replace(/'/g, "''");
    scoreComponents.push(`
      CASE 
        WHEN p.name = '${escapedLocation}' THEN 25
        WHEN p.name LIKE '%${escapedLocation}%' OR '${escapedLocation}' LIKE CONCAT('%', p.name, '%') THEN 15
        ELSE 0
      END`);
  }
  
  // スコア計算のSELECT句を構築
  if (scoreComponents.length > 0) {
    preferenceScoreSelect = `, (${scoreComponents.join(' + ')}) as preference_score`;
  } else {
    preferenceScoreSelect = ', 0 as preference_score';
  }
  
  // Distance calculation and order by clause
  let distanceSelect = '';
  let areaJoin = '';
  let orderByClause = 'ORDER BY (g.age IS NULL), g.created_at DESC';
  
  if (userLat && userLng) {
    // area_smallsテーブルから位置情報を取得するJOINを追加
    areaJoin = `
      LEFT JOIN (
        SELECT area_prefecture_id, 
               AVG(latitude) as area_lat, 
               AVG(longitude) as area_lng,
               MIN(ST_Distance_Sphere(
                 POINT(longitude, latitude), 
                 POINT(${userLng}, ${userLat})
               ) / 1000) as min_distance_km
        FROM area_smalls
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY area_prefecture_id
      ) area_loc ON s.area_prefecture_id = area_loc.area_prefecture_id`;
    
    // 位置情報がある場合は距離計算を追加
    distanceSelect = `,
      CASE 
        WHEN s.latitude IS NOT NULL AND s.longitude IS NOT NULL 
        THEN ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(${userLng}, ${userLat})) / 1000
        WHEN area_loc.area_lat IS NOT NULL AND area_loc.area_lng IS NOT NULL
        THEN ST_Distance_Sphere(POINT(area_loc.area_lng, area_loc.area_lat), POINT(${userLng}, ${userLat})) / 1000
        ELSE 999999
      END as distance_km,
      -- より簡潔な最短距離を使用
      COALESCE(area_loc.min_distance_km, 999999) as area_min_distance`;
  }
  
  // スコアと距離の複合ソート
  if (scoreComponents.length > 0 || userLat) {
    orderByClause = `ORDER BY 
      CASE 
        WHEN distance_km > 5 THEN distance_km * 1000
        ELSE distance_km * 1000 - preference_score
      END ASC,
      g.created_at DESC`;
  }
  
  // Optimized query with distance calculation
  const girlsQuery = `
    SELECT STRAIGHT_JOIN
      g.id,
      g.name,
      g.age,
      g.height,
      g.weight,
      g.bust,
      g.cup,
      g.waist,
      g.hip,
      g.is_sake,
      g.is_tobacco,
      IFNULL(COALESCE(g.comment, g.catch_copy), '') as bio,
      IFNULL(g.hobby, '') as hobby,
      s.id as shop_id,
      s.name as shop_name,
      s.latitude,
      s.longitude,
      IFNULL(p.name, '') as location,
      IFNULL(m.name, '') as municipality,
      (
        SELECT gi.image_url 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        ORDER BY gi.id ASC
        LIMIT 1
      ) as imageUrl,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', gt.id, 'name', gt.name))
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gs.girl_profile_id = g.id
      ) as girl_types_json
      ${distanceSelect}
      ${preferenceScoreSelect}
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${girlTypesJoin}
    ${preferenceJoins}
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
    ${areaJoin}
    ${whereClause}
    ${orderByClause}
    LIMIT ${limitCount} OFFSET ${offset}
  `;
  
  // Count query (simplified)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${girlTypesJoin}
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id' : ''}
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id' : ''}
    ${whereClause}
  `;
  
  // Debug: Log the actual query (詳細なログ出力)
  if (area && area !== 'all' || userLat && userLng || scoreComponents.length > 0) {
    console.log('🔍 Executing query with params:', { 
      area, 
      userLat, 
      userLng, 
      maxDistance,
      ageMin, 
      ageMax,
      recordingDuringPlay,
      isSadist,
      isMasochist,
      partnerHeight,
      partnerWeight,
      partnerLocation
    });
    console.log('📝 WHERE clause:', whereClause);
    console.log('📊 Score components:', scoreComponents.length);
    console.log('📊 Query parameters:', { limitCount, offset, ageMin, ageMax });
  }
  
  // Execute both queries in parallel with caching
  // モバイルの場合はキャッシュTTLを短くする
  const isMobileRequest = limitCount === 1000 && area && area.includes('都');
  const girlsCacheTTL = isMobileRequest ? 30000 : 60000; // モバイルは30秒、PCは1分
  const countCacheTTL = isMobileRequest ? 60000 : 300000; // モバイルは1分、PCは5分
  
  const [girlsResult, countResult] = await Promise.all([
    cachedQuery<any>(girlsQuery, [], cacheKey, girlsCacheTTL),
    cachedQuery<any>(countQuery, [], countCacheKey, countCacheTTL)
  ]);
  
  console.log(`📊 Area: ${area}, Found: ${girlsResult.length} girls, Total: ${countResult[0]?.total || 0}`);
  
  // Process results
  const girls: MySQLGirlProfile[] = girlsResult.map(row => ({
    id: row.id.toString(),
    name: row.name || 'Unknown',
    age: row.age || null,
    height: row.height || undefined,
    bust: row.bust || undefined,
    cup: row.cup || undefined,
    waist: row.waist || undefined,
    hip: row.hip || undefined,
    location: row.location,
    municipality: row.municipality || undefined,
    bio: row.bio || '',
    interests: parseInterests(row.hobby || ''),
    imageUrl: row.imageUrl || '/img/noimage.jpg',
    bodyType: undefined,
    style: undefined,
    isOnline: Math.random() > 0.7,
    lastActive: new Date().toISOString(),
    is_sake: row.is_sake === 1 || row.is_sake === true,
    is_tobacco: row.is_tobacco === 1 || row.is_tobacco === true,
    shopName: row.shop_name,
    shopId: row.shop_id,
    // Shop object for distance calculation
    shop: {
      id: row.shop_id,
      name: row.shop_name,
      latitude: row.latitude,
      longitude: row.longitude
    },
    // 計算済みの距離を追加
    distance_km: row.distance_km || undefined,
    // Girl types from girl_status table (parse JSON if string, otherwise use as-is)
    girlTypes: (() => {
      if (!row.girl_types_json) return [];
      // MySQLのJSON型は自動的にパースされることがある
      if (typeof row.girl_types_json === 'string') {
        try {
          return JSON.parse(row.girl_types_json);
        } catch (e) {
          console.error('Failed to parse girl_types_json:', row.girl_types_json);
          return [];
        }
      }
      // 既にオブジェクト/配列の場合はそのまま使用
      return Array.isArray(row.girl_types_json) ? row.girl_types_json : [];
    })()
  }));
  
  const total = countResult[0]?.total || 0;
  
  return { girls, total };
}

/**
 * Prefetch next page for instant loading
 */
export async function prefetchNextPage(
  currentOffset: number,
  limitCount: number = 200,
  area?: string | null,
  ageMin: number = 18,
  ageMax: number = 50,
  girlTypes?: string[] | null,
  girlId?: string | null,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null,
  recordingDuringPlay?: string | null,
  isSadist?: string | null,
  isMasochist?: string | null,
  partnerHeight?: string | null,
  partnerWeight?: string | null,
  partnerLocation?: string | null
): Promise<void> {
  // Don't prefetch if fetching specific girl
  if (girlId) return;
  const nextOffset = currentOffset + limitCount;
  const girlTypesStr = girlTypes ? girlTypes.sort().join(',') : '';
  const locationStr = userLat && userLng ? `${userLat.toFixed(2)}_${userLng.toFixed(2)}` : 'no_loc';
  const distStr = maxDistance ? `d${maxDistance}` : 'no_dist';
  const userPrefsStr = `${recordingDuringPlay || 'n'}:${isSadist || 'n'}:${isMasochist || 'n'}:${partnerHeight || 'n'}:${partnerWeight || 'n'}:${partnerLocation || 'n'}`;
  const cacheKey = `girls:${limitCount}:${nextOffset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  
  // Check if already cached
  if (!cacheKey) {
    // Prefetch in background
    setTimeout(() => {
      fetchOptimizedGirls(limitCount, nextOffset, area, ageMin, ageMax, girlTypes, null, userLat, userLng, maxDistance, recordingDuringPlay, isSadist, isMasochist, partnerHeight, partnerWeight, partnerLocation);
    }, 100);
  }
}

/**
 * Batch fetch multiple girl profiles by IDs
 */
export async function batchFetchGirls(ids: string[]): Promise<MySQLGirlProfile[]> {
  if (ids.length === 0) return [];
  
  const placeholders = ids.map(() => '?').join(',');
  const query = `
    SELECT 
      g.id,
      g.name,
      g.age,
      g.height,
      g.bust,
      g.cup,
      g.waist,
      g.hip,
      g.is_sake,
      g.is_tobacco,
      IFNULL(COALESCE(g.comment, g.catch_copy), '') as bio,
      IFNULL(g.hobby, '') as hobby,
      s.name as shop_name,
      IFNULL(p.name, '') as location,
      IFNULL(m.name, '') as municipality,
      (
        SELECT gi.image_url 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        ORDER BY gi.id ASC
        LIMIT 1
      ) as imageUrl,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', gt.id, 'name', gt.name))
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gs.girl_profile_id = g.id
      ) as girl_types_json
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    WHERE g.id IN (${placeholders})
      AND g.is_displayed = 1
      AND g.deleted_at IS NULL
  `;
  
  const cacheKey = `batch:${ids.join(',')}`;
  const results = await cachedQuery<any>(query, ids, cacheKey, 60000);
  
  return results.map(row => ({
    id: row.id.toString(),
    name: row.name || 'Unknown',
    age: row.age || null,
    height: row.height || undefined,
    bust: row.bust || undefined,
    cup: row.cup || undefined,
    waist: row.waist || undefined,
    hip: row.hip || undefined,
    location: row.municipality ? `${row.location} ${row.municipality}` : row.location,
    bio: row.bio || '',
    interests: parseInterests(row.hobby || ''),
    imageUrl: row.imageUrl || '/img/noimage.jpg',
    bodyType: undefined,
    style: undefined,
    isOnline: Math.random() > 0.7,
    lastActive: new Date().toISOString(),
    is_sake: row.is_sake === 1 || row.is_sake === true,
    is_tobacco: row.is_tobacco === 1 || row.is_tobacco === true,
    shopName: row.shop_name,
    // Girl types from girl_status table (parse JSON if string, otherwise use as-is)
    girlTypes: (() => {
      if (!row.girl_types_json) return [];
      // MySQLのJSON型は自動的にパースされることがある
      if (typeof row.girl_types_json === 'string') {
        try {
          return JSON.parse(row.girl_types_json);
        } catch (e) {
          console.error('Failed to parse girl_types_json:', row.girl_types_json);
          return [];
        }
      }
      // 既にオブジェクト/配列の場合はそのまま使用
      return Array.isArray(row.girl_types_json) ? row.girl_types_json : [];
    })()
  }));
}

function parseInterests(hobby: string): string[] {
  if (!hobby) return [];
  
  // Split by common delimiters
  const interests = hobby
    .split(/[、,・]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 5);
  
  return interests.length > 0 ? interests : ['カフェ巡り', '映画鑑賞'];
}

const girlsOptimized = {
  fetchOptimizedGirls,
  prefetchNextPage,
  batchFetchGirls
};

export default girlsOptimized;