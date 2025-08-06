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
  // Shop info
  shopName?: string;
  shopId?: number;
}

/**
 * Get total count of girls
 * @returns Total number of girls
 */
export async function getTotalGirlsCount(): Promise<number> {
  try {
    const result = await query<any>(`
      SELECT COUNT(*) as total
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
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
  offset: number = 0
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
        IFNULL(g.catch_copy, '') as bio,
        IFNULL(g.hobby, '') as hobby,
        IFNULL(g.seikantai, '') as seikantai,
        s.id as shop_id,
        s.name as shop_name,
        COALESCE(p.name, '東京') as location,
        s.latitude,
        s.longitude
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      ORDER BY g.id DESC
      LIMIT ${parseInt(limitCount.toString())} OFFSET ${parseInt(offset.toString())}
    `;
    
    const girls = await query<any>(sql);
    

    // Fetch images for all girls
    const girlIds = girls.map((g: any) => g.id).join(',');
    let images: any[] = [];
    
    if (girlIds) {
      images = await query<any>(`
        SELECT DISTINCT girl_profile_id, MIN(image_url) as url 
        FROM girl_image_urls 
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
        is_tobacco: girl.is_tobacco === 1 || girl.is_tobacco === true
      };
    });
  } catch (error) {
    console.error('Error fetching girls from MySQL:', error);
    console.error('SQL Query:', sql);
    throw error;
  }
}