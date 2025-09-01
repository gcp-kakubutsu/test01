import { cachedQuery, batchQueries } from './db-optimized';
import { MySQLGirlProfile } from './girls';

// Optimized indexes for better query performance
const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_girl_age_display ON girl_profiles(age, is_displayed, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_shop_active ON shop_profiles(is_active, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_area_prefecture ON shop_profiles(area_prefecture_id);
  CREATE INDEX IF NOT EXISTS idx_girl_shop ON girl_profiles(shop_profile_id);
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
  maxDistance?: number | null
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
  const cacheKey = `girls:${limitCount}:${offset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}`;
  const countCacheKey = `count:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}`;
  
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
    
    // 最短距離でソート（area_smallsの中で最も近い場所を基準に）
    orderByClause = `ORDER BY 
      CASE 
        WHEN area_loc.min_distance_km IS NULL THEN 999999
        ELSE area_loc.min_distance_km
      END ASC,
      distance_km ASC, 
      g.created_at DESC`;
  }
  
  // Optimized query with distance calculation
  const girlsQuery = `
    SELECT STRAIGHT_JOIN
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
      s.id as shop_id,
      s.name as shop_name,
      s.latitude,
      s.longitude,
      IFNULL(p.name, '') as location,
      IFNULL(m.name, '') as municipality,
      (
        SELECT MIN(gi.image_url) 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        LIMIT 1
      ) as imageUrl,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', gt.id, 'name', gt.name))
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gs.girl_profile_id = g.id
      ) as girl_types_json
      ${distanceSelect}
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${girlTypesJoin}
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
  if (area && area !== 'all' || userLat && userLng) {
    console.log('🔍 Executing query with params:', { area, userLat, userLng, maxDistance });
    console.log('📝 WHERE clause:', whereClause);
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
  maxDistance?: number | null
): Promise<void> {
  // Don't prefetch if fetching specific girl
  if (girlId) return;
  const nextOffset = currentOffset + limitCount;
  const girlTypesStr = girlTypes ? girlTypes.sort().join(',') : '';
  const locationStr = userLat && userLng ? `${userLat.toFixed(2)}_${userLng.toFixed(2)}` : 'no_loc';
  const distStr = maxDistance ? `d${maxDistance}` : 'no_dist';
  const cacheKey = `girls:${limitCount}:${nextOffset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}`;
  
  // Check if already cached
  if (!cacheKey) {
    // Prefetch in background
    setTimeout(() => {
      fetchOptimizedGirls(limitCount, nextOffset, area, ageMin, ageMax, girlTypes, null, userLat, userLng, maxDistance);
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
        SELECT MIN(gi.image_url) 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
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