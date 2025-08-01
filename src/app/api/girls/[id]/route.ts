import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';
import { GirlImageUrl, GirlWithDetails } from '@/types/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const girlId = parseInt(params.id);
    
    if (isNaN(girlId)) {
      return NextResponse.json(
        { error: 'Invalid girl ID' },
        { status: 400 }
      );
    }
    
    // Fetch girl with shop and location information
    const girlQuery = `
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
      WHERE g.id = ? AND g.is_displayed = 1 AND g.deleted_at IS NULL
    `;
    
    const girls = await query<any>(girlQuery, [girlId]);
    
    if (girls.length === 0) {
      return NextResponse.json(
        { error: 'Girl not found' },
        { status: 404 }
      );
    }
    
    const girl = girls[0];
    
    // Fetch images
    const imagesQuery = `
      SELECT * FROM girl_image_urls 
      WHERE girl_profile_id = ?
      ORDER BY sort_order ASC
    `;
    
    const images = await query<GirlImageUrl>(imagesQuery, [girlId]);
    
    // Format the response
    const location = [girl.prefecture_name, girl.municipality_name].filter(Boolean).join(' ');
    
    const girlWithDetails: GirlWithDetails = {
      id: girl.id,
      shop_profile_id: girl.shop_profile_id,
      name: girl.name,
      katakana: girl.katakana,
      hiragana: girl.hiragana,
      alphabet: girl.alphabet,
      birth_day: girl.birth_day,
      age: girl.age,
      blood: girl.blood,
      entry_day: girl.entry_day,
      height: girl.height,
      weight: girl.weight,
      bust: girl.bust,
      cup: girl.cup,
      waist: girl.waist,
      hip: girl.hip,
      catch_copy: girl.catch_copy,
      seikantai: girl.seikantai,
      hobby: girl.hobby,
      tokui_play: girl.tokui_play,
      charm_point: girl.charm_point,
      favorite: girl.favorite,
      hatsutaiken: girl.hatsutaiken,
      birth_place: girl.birth_place,
      star: girl.star,
      mobile_email: girl.mobile_email,
      pc_email: girl.pc_email,
      is_face: girl.is_face,
      is_sake: girl.is_sake,
      is_tobacco: girl.is_tobacco,
      is_new_face: girl.is_new_face,
      is_displayed: girl.is_displayed,
      is_sokuhime: girl.is_sokuhime,
      character: girl.character,
      shop_comment: girl.shop_comment,
      girl_comment: girl.girl_comment,
      comment: girl.comment,
      deleted_at: girl.deleted_at,
      created_at: girl.created_at,
      updated_at: girl.updated_at,
      shop: {
        id: girl.shop_id,
        name: girl.shop_name,
        name_kana: girl.shop_name_kana,
        alphabet: girl.shop_alphabet,
        shop_job_type_id: girl.shop_job_type_id,
        is_delivery: girl.shop_is_delivery,
        is_partner: girl.shop_is_partner,
        tel: girl.shop_tel,
        email: girl.shop_email,
        website_url: girl.shop_website_url,
        area_prefecture_id: girl.area_prefecture_id,
        area_prefectural_municipality_id: girl.area_prefectural_municipality_id,
        address_detail: girl.shop_address_detail,
        latitude: girl.shop_latitude,
        longitude: girl.shop_longitude,
        minimum_price: girl.shop_minimum_price,
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
        created_at: girl.created_at,
        updated_at: girl.updated_at
      },
      images,
      location
    };
    
    return NextResponse.json(girlWithDetails);
    
  } catch (error) {
    console.error('Error fetching girl details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch girl details' },
      { status: 500 }
    );
  }
}