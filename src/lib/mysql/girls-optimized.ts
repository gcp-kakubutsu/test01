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
  ageMax: number = 50
): Promise<{ girls: MySQLGirlProfile[], total: number }> {
  // Generate cache key based on parameters
  const cacheKey = `girls:${limitCount}:${offset}:${area || 'all'}:${ageMin}:${ageMax}`;
  const countCacheKey = `count:${area || 'all'}:${ageMin}:${ageMax}`;
  
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
    
    // 市区町村名の完全一致
    areaConditions.push(`m.name = '${escapedArea}'`);
    
    // 都道府県+市区町村の組み合わせ
    areaConditions.push(`CONCAT(IFNULL(p.name, ''), ' ', IFNULL(m.name, '')) = '${escapedArea}'`);
    
    // 都府県の接尾辞を柔軟に処理
    const suffixPattern = /[都府県]$/;
    if (suffixPattern.test(escapedArea)) {
      // 接尾辞を除いた形でも検索
      const withoutSuffix = escapedArea.replace(suffixPattern, '');
      areaConditions.push(`p.name LIKE '${withoutSuffix}%'`);
      // 接尾辞なしの完全一致も追加
      areaConditions.push(`p.name = '${withoutSuffix}'`);
    } else {
      // 接尾辞がない場合は、接尾辞付きの形も検索
      areaConditions.push(`p.name LIKE '${escapedArea}%'`);
      areaConditions.push(`p.name = '${escapedArea}都'`);
      areaConditions.push(`p.name = '${escapedArea}府'`);
      areaConditions.push(`p.name = '${escapedArea}県'`);
    }
    
    whereConditions.push(
      `(${areaConditions.join(' OR ')})`
    );
  }
  
  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  
  // Optimized query with reduced columns and better joins
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
      p.name as location,
      m.name as municipality,
      (
        SELECT MIN(gi.image_url) 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        LIMIT 1
      ) as imageUrl
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
    ${whereClause}
    ORDER BY (g.age IS NULL), g.created_at DESC
    LIMIT ${limitCount} OFFSET ${offset}
  `;
  
  // Count query (simplified)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id' : ''}
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id' : ''}
    ${whereClause}
  `;
  
  // Debug: Log the actual query (詳細なログ出力)
  if (area && area !== 'all') {
    console.log('🔍 Executing query for area:', area);
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
    shopId: row.shop_id,
    // Shop object for distance calculation
    shop: {
      id: row.shop_id,
      name: row.shop_name,
      latitude: row.latitude,
      longitude: row.longitude
    }
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
  ageMax: number = 50
): Promise<void> {
  const nextOffset = currentOffset + limitCount;
  const cacheKey = `girls:${limitCount}:${nextOffset}:${area || 'all'}:${ageMin}:${ageMax}`;
  
  // Check if already cached
  if (!cacheKey) {
    // Prefetch in background
    setTimeout(() => {
      fetchOptimizedGirls(limitCount, nextOffset, area, ageMin, ageMax);
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
      p.name as location,
      m.name as municipality,
      (
        SELECT MIN(gi.image_url) 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        LIMIT 1
      ) as imageUrl
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
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
    shopName: row.shop_name
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

export default {
  fetchOptimizedGirls,
  prefetchNextPage,
  batchFetchGirls
};