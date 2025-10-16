import { query } from './db';

export interface MySQLGirlProfile {
  id: string;
  name: string;
  age: number;
  height?: number;
  bust?: number;
  cup?: string;
  waist?: number;
  hip?: number;
  location: string;
  municipality?: string;
  bio: string;
  interests: string[];
  imageUrl: string;
  bodyType?: string;
  style?: string;
  distance?: number;
  isOnline?: boolean;
  lastActive?: string;
  is_sake?: boolean;
  is_tobacco?: boolean;
  is_working_today?: boolean;
  isWorkingToday?: boolean;
  // Shop info
  shopName?: string;
  shopId?: number;
  latitude?: number;
  longitude?: number;
  // Shop object for distance calculation
  shop?: {
    id: number;
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  // Girl types (personality, physical characteristics, etc.)
  girlTypes?: string[];
}

/**
 * Get total count of girls
 * @returns Total number of girls
 */
export async function getTotalGirlsCount(area?: string | null, ageMin?: number, ageMax?: number): Promise<number> {
  try {
    let whereClause = `
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
    `;
    
    if (area && area !== 'all') {
      // SQLインジェクション対策のためエスケープ
      const escapedArea = area.replace(/'/g, "''");
      // p.name (都道府県), m.name (市区町村), または結合した名前でマッチ
      whereClause += ` AND (p.name = '${escapedArea}' OR m.name = '${escapedArea}' OR CONCAT(p.name, ' ', m.name) = '${escapedArea}')`;
    }
    
    if (ageMin !== undefined && ageMax !== undefined) {
      // NULL年齢も含めるように修正
      whereClause += ` AND (g.age IS NULL OR g.age BETWEEN ${ageMin} AND ${ageMax})`;
    }
    
    const result = await query<any>(`
      SELECT COUNT(*) as total
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
      ${whereClause}
    `);
    
    return result[0]?.total || 0;
  } catch (error) {
    console.error('Error getting total girls count:', error);
    return 0;
  }
}

/**
 * Fetch girls from MySQL database
 * @param limit - Maximum number of results
 * @param offset - Offset for pagination
 * @returns Array of girl profiles
 */
export async function fetchMySQLGirls(
  limitCount: number = 1000,
  offset: number = 0,
  area?: string | null,
  ageMin?: number,
  ageMax?: number
): Promise<MySQLGirlProfile[]> {
  let sql = '';
  try {
    // Build query with safe limit and offset
    sql = `
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
        IFNULL(g.seikantai, '') as seikantai,
        s.id as shop_id,
        s.name as shop_name,
        p.name as location,
        s.latitude,
        s.longitude
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
        ${area && area !== 'all' ? `AND (p.name = '${area.replace(/'/g, "''")}' OR m.name = '${area.replace(/'/g, "''")}' OR CONCAT(p.name, ' ', m.name) = '${area.replace(/'/g, "''")}')` : ''}
        ${ageMin !== undefined && ageMax !== undefined ? `AND (g.age IS NULL OR g.age BETWEEN ${ageMin} AND ${ageMax})` : ''}
      ORDER BY g.id DESC
      LIMIT ${parseInt(limitCount.toString())} OFFSET ${parseInt(offset.toString())}
    `;
    
    console.log('Executing SQL query for area:', area);
    console.log('SQL:', sql);
    
    const girls = await query<any>(sql);
    
    console.log('Query returned', girls.length, 'girls');
    

    // Fetch images for all girls
    const girlIds = girls.map((g: any) => g.id).join(',');
    let images: any[] = [];
    
    if (girlIds) {
      images = await query<any>(`
        SELECT DISTINCT girl_profile_id, 
               (SELECT image_url FROM girl_image_urls 
                WHERE girl_profile_id = giu.girl_profile_id 
                ORDER BY id ASC LIMIT 1) as url
        FROM girl_image_urls giu
        WHERE girl_profile_id IN (${girlIds})
        GROUP BY girl_profile_id
      `);
    }
    
    const imageMap = new Map(images.map((img: any) => [img.girl_profile_id, img.url]));

    // Transform MySQL data to match our interface
    return girls.map((girl: any) => {
      // Combine interests from various fields
      const interests: string[] = [];
      
      if (girl.hobby) {
        interests.push(...girl.hobby.split(/[、,]/));
      }
      if (girl.seikantai) {
        interests.push(...girl.seikantai.split(/[、,]/));
      }

      return {
        id: girl.id.toString(),
        name: girl.name || '名前なし',
        age: girl.age || 20,
        height: girl.height || undefined,
        bust: girl.bust || undefined,
        cup: girl.cup || undefined,
        waist: girl.waist || undefined,
        hip: girl.hip || undefined,
        location: girl.location,
        bio: girl.bio || '',
        interests: interests.filter(Boolean),
        imageUrl: imageMap.get(girl.id) || '/images/default-avatar.jpg',
        shopName: girl.shop_name,
        shopId: girl.shop_id,
        bodyType: undefined,
        style: undefined,
        isOnline: false,
        lastActive: new Date().toISOString(),
        is_sake: girl.is_sake === 1 || girl.is_sake === true,
        is_tobacco: girl.is_tobacco === 1 || girl.is_tobacco === true,
        // Shop object for distance calculation
        shop: {
          id: girl.shop_id,
          name: girl.shop_name,
          latitude: girl.latitude,
          longitude: girl.longitude
        }
      };
    });
  } catch (error) {
    console.error('Error fetching girls from MySQL:', error);
    console.error('SQL Query:', sql);
    throw error;
  }
}
