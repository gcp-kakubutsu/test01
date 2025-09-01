import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    console.log('=== area_smallsテーブル調査 ===');
    
    // 1. area_smallsテーブルの構造確認
    const structure = await query(`DESCRIBE area_smalls`);
    
    // 2. area_smallsのデータ件数と位置情報の有無
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_location,
        COUNT(CASE WHEN latitude != 0 AND longitude != 0 THEN 1 END) as valid_location,
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lon,
        MAX(longitude) as max_lon
      FROM area_smalls
    `);
    
    // 3. 実際のデータサンプル（東京周辺）
    const tokyoAreas = await query(`
      SELECT 
        a.id,
        a.name,
        a.latitude,
        a.longitude,
        a.area_prefecture_id,
        p.name as prefecture_name
      FROM area_smalls a
      LEFT JOIN area_prefectures p ON a.area_prefecture_id = p.id
      WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      ORDER BY 
        ABS(a.latitude - 35.6762) + ABS(a.longitude - 139.6503) ASC
      LIMIT 20
    `);
    
    // 4. shop_profilesとarea_smallsの関連を調査
    const shopAreaRelation = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_shops,
        COUNT(DISTINCT s.area_prefecture_id) as unique_prefectures,
        COUNT(DISTINCT s.area_prefectural_municipality_id) as unique_municipalities,
        COUNT(DISTINCT CASE WHEN s.address_detail LIKE '%東京%' THEN s.id END) as tokyo_shops,
        COUNT(DISTINCT CASE WHEN s.address_detail LIKE '%大阪%' THEN s.id END) as osaka_shops
      FROM shop_profiles s
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
    `);
    
    // 5. area_smallsを使った店舗の地域マッピング可能性を確認
    const mappingPossibility = await query(`
      SELECT 
        s.id,
        s.name as shop_name,
        s.address_detail,
        s.area_prefecture_id,
        p.name as prefecture_name,
        m.name as municipality_name,
        COUNT(g.id) as girl_count
      FROM shop_profiles s
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id AND g.is_displayed = 1 AND g.deleted_at IS NULL
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY girl_count DESC
      LIMIT 10
    `);
    
    // 6. area_smallsとshop addressの文字列マッチング可能性
    const addressMatching = await query(`
      SELECT 
        a.name as area_name,
        a.latitude,
        a.longitude,
        COUNT(s.id) as matching_shops
      FROM area_smalls a
      INNER JOIN shop_profiles s ON 
        s.address_detail LIKE CONCAT('%', a.name, '%')
        AND s.is_active = 1 
        AND s.deleted_at IS NULL
      WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      GROUP BY a.id
      ORDER BY matching_shops DESC
      LIMIT 20
    `);
    
    return NextResponse.json({
      success: true,
      tableStructure: structure,
      statistics: stats[0],
      tokyoAreaSamples: tokyoAreas,
      shopAreaRelation: shopAreaRelation[0],
      topShopsByArea: mappingPossibility,
      addressMatchingResults: addressMatching,
      analysis: {
        hasLocationData: (stats[0]?.valid_location || 0) > 0,
        totalAreas: stats[0]?.total || 0,
        areasWithLocation: stats[0]?.with_location || 0,
        coveragePercent: stats[0]?.total ? 
          ((stats[0]?.with_location || 0) / stats[0].total * 100).toFixed(2) + '%' : '0%'
      }
    });
    
  } catch (error) {
    console.error('area_smalls調査エラー:', error);
    return NextResponse.json(
      { 
        error: 'area_smalls調査に失敗しました',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}