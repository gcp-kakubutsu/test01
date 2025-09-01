import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting database structure check...');
    
    // 1. shop_profilesテーブルの構造を確認
    const shopStructure = await query(
      `DESCRIBE shop_profiles`
    );
    
    // 2. girl_profilesテーブルの構造を確認
    const girlStructure = await query(
      `DESCRIBE girl_profiles`
    );
    
    // 3. 実際のデータサンプルを取得（緯度経度が存在するものを優先）
    const sampleShops = await query(
      `SELECT id, name, latitude, longitude, area_prefecture_id, area_prefectural_municipality_id, address_detail
       FROM shop_profiles 
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       LIMIT 5`
    );
    
    // 4. 緯度経度がNULLのデータも確認
    const nullLocationShops = await query(
      `SELECT COUNT(*) as count FROM shop_profiles WHERE latitude IS NULL OR longitude IS NULL`
    );
    
    // 5. 緯度経度が存在するデータの数を確認
    const validLocationShops = await query(
      `SELECT COUNT(*) as count FROM shop_profiles WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
    );
    
    // 6. girl_profilesとshop_profilesの関連を確認
    const sampleGirls = await query(
      `SELECT 
        g.id, g.name, g.shop_profile_id,
        s.name as shop_name, s.latitude, s.longitude
       FROM girl_profiles g
       JOIN shop_profiles s ON g.shop_profile_id = s.id
       WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       LIMIT 5`
    );
    
    return NextResponse.json({
      success: true,
      shopTableStructure: shopStructure,
      girlTableStructure: girlStructure,
      sampleShopsWithLocation: sampleShops,
      statistics: {
        shopsWithoutLocation: nullLocationShops[0]?.count || 0,
        shopsWithLocation: validLocationShops[0]?.count || 0
      },
      sampleGirlsWithShopLocation: sampleGirls
    });
    
  } catch (error) {
    console.error('Database structure check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check database structure',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}