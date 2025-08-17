import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';
import { GirlProfile, ShopProfile, AreaPrefecture, AreaPrefecturalMunicipality, GirlImageUrl, GirlWithDetails } from '@/types/database';
import { queryCache } from '@/lib/cache/queryCache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const prefectureId = searchParams.get('prefecture_id');
    const municipalityId = searchParams.get('municipality_id');
    
    // Create cache key from request parameters
    const cacheKey = `girls:${limit}:${offset}:${prefectureId || 'all'}:${municipalityId || 'all'}`;
    
    // Check cache first
    const cachedData = queryCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    
    // Build the WHERE clause based on filters
    let whereConditions = ['g.is_displayed = 1', 'g.deleted_at IS NULL', 's.is_active = 1', 's.deleted_at IS NULL'];
    const params: any[] = [];
    
    if (prefectureId) {
      whereConditions.push('s.area_prefecture_id = ?');
      params.push(prefectureId);
    }
    
    if (municipalityId) {
      whereConditions.push('s.area_prefectural_municipality_id = ?');
      params.push(municipalityId);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Fetch girls with shop and location information
    const girlsQuery = `
      SELECT 
        g.*,
        s.id as shop_id,
        s.name as shop_name,
        s.name_kana as shop_name_kana,
        s.alphabet as shop_alphabet,
        s.shop_job_type_id,
        s.is_delivery as shop_is_delivery,
        s.is_partner as shop_is_partner,
        s.tel as shop_tel,
        s.email as shop_email,
        s.website_url as shop_website_url,
        s.area_prefecture_id,
        s.area_prefectural_municipality_id,
        s.address_detail as shop_address_detail,
        s.latitude as shop_latitude,
        s.longitude as shop_longitude,
        s.minimum_price as shop_minimum_price,
        p.name as prefecture_name,
        m.name as municipality_name
      FROM girl_profiles g
      JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
      WHERE ${whereClause}
      ORDER BY g.created_at DESC
      LIMIT ${parseInt(limit.toString())} OFFSET ${parseInt(offset.toString())}
    `;
    
    // Note: LIMIT and OFFSET are now embedded in the SQL string
    
    const girls = await query<any>(girlsQuery, params);
    
    // Get girl IDs for fetching images
    const girlIds = girls.map(g => g.id);
    
    if (girlIds.length === 0) {
      return NextResponse.json({ girls: [], total: 0 });
    }
    
    // Fetch images for all girls (image_type = 2 for non-thumbnail images)
    // Get only the first image for each girl for the list view
    const imagesQuery = `
      SELECT giu.* 
      FROM girl_image_urls giu
      INNER JOIN (
        SELECT girl_profile_id, MIN(sort_order) as min_sort_order
        FROM girl_image_urls
        WHERE girl_profile_id IN (${girlIds.map(() => '?').join(',')}) 
          AND image_type = 2
        GROUP BY girl_profile_id
      ) first_img ON giu.girl_profile_id = first_img.girl_profile_id 
        AND giu.sort_order = first_img.min_sort_order
        AND giu.image_type = 2
    `;
    
    const images = await query<GirlImageUrl>(imagesQuery, girlIds);
    
    // Group images by girl_profile_id
    const imagesByGirlId = images.reduce((acc, img) => {
      if (!acc[img.girl_profile_id]) {
        acc[img.girl_profile_id] = [];
      }
      acc[img.girl_profile_id].push(img);
      return acc;
    }, {} as Record<number, GirlImageUrl[]>);
    
    // Format the response
    const girlsWithDetails: GirlWithDetails[] = girls.map(g => {
      const location = [g.prefecture_name, g.municipality_name].filter(Boolean).join(' ');
      
      return {
        id: g.id,
        shop_profile_id: g.shop_profile_id,
        name: g.name,
        katakana: g.katakana,
        hiragana: g.hiragana,
        alphabet: g.alphabet,
        birth_day: g.birth_day,
        age: g.age,
        blood: g.blood,
        entry_day: g.entry_day,
        height: g.height,
        weight: g.weight,
        bust: g.bust,
        cup: g.cup,
        waist: g.waist,
        hip: g.hip,
        catch_copy: g.catch_copy,
        seikantai: g.seikantai,
        hobby: g.hobby,
        tokui_play: g.tokui_play,
        charm_point: g.charm_point,
        favorite: g.favorite,
        hatsutaiken: g.hatsutaiken,
        birth_place: g.birth_place,
        star: g.star,
        mobile_email: g.mobile_email,
        pc_email: g.pc_email,
        is_face: g.is_face,
        is_sake: g.is_sake,
        is_tobacco: g.is_tobacco,
        is_new_face: g.is_new_face,
        is_displayed: g.is_displayed,
        is_sokuhime: g.is_sokuhime,
        character: g.character,
        shop_comment: g.shop_comment,
        girl_comment: g.girl_comment,
        comment: g.comment,
        deleted_at: g.deleted_at,
        created_at: g.created_at,
        updated_at: g.updated_at,
        shop: {
          id: g.shop_id,
          name: g.shop_name,
          name_kana: g.shop_name_kana,
          alphabet: g.shop_alphabet,
          shop_job_type_id: g.shop_job_type_id,
          is_delivery: g.shop_is_delivery,
          is_partner: g.shop_is_partner,
          tel: g.shop_tel,
          email: g.shop_email,
          website_url: g.shop_website_url,
          area_prefecture_id: g.area_prefecture_id,
          area_prefectural_municipality_id: g.area_prefectural_municipality_id,
          address_detail: g.shop_address_detail,
          latitude: g.shop_latitude,
          longitude: g.shop_longitude,
          minimum_price: g.shop_minimum_price,
          reception_start_time: undefined,
          business_hours_from: undefined,
          business_hours_to: undefined,
          business_days: undefined,
          access_notes: undefined,
          postal_code: undefined,
          pricing_system_image_url: undefined,
          introduction_text: undefined,
          support_24h: false,
          genre1: undefined,
          genre2: undefined,
          genre3: undefined,
          shop_image_url: undefined,
          shop_real_image_url: undefined,
          whatsnews: undefined,
          is_active: true,
          deleted_at: undefined,
          created_at: g.created_at,
          updated_at: g.updated_at
        },
        images: imagesByGirlId[g.id] || [],
        location
      };
    });
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM girl_profiles g
      JOIN shop_profiles s ON g.shop_profile_id = s.id
      WHERE ${whereClause}
    `;
    
    const countResult = await query<{ total: number }>(countQuery, params.slice(0, -2));
    const total = countResult[0]?.total || 0;
    
    const responseData = {
      girls: girlsWithDetails,
      total,
      limit,
      offset
    };
    
    // Cache the result for 2 minutes
    queryCache.set(cacheKey, responseData, 120000);
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[/api/girls] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch girls data',
        message: error instanceof Error ? error.message : 'Unknown error',
        girls: [],
        total: 0
      },
      { status: 500 }
    );
  }
}