import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    // 1. 位置情報を持つショップの統計
    const stats = await query(`
      SELECT 
        COUNT(*) as total_shops,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_location,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0 THEN 1 END) as valid_location,
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lon,
        MAX(longitude) as max_lon,
        AVG(latitude) as avg_lat,
        AVG(longitude) as avg_lon
      FROM shop_profiles
      WHERE is_active = 1 AND deleted_at IS NULL
    `);
    
    // 2. 有効な位置情報を持つショップのサンプル
    const validShops = await query(`
      SELECT 
        s.id, s.name, s.latitude, s.longitude, s.address_detail,
        p.name as prefecture_name,
        COUNT(g.id) as girl_count
      FROM shop_profiles s
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id AND g.is_displayed = 1 AND g.deleted_at IS NULL
      WHERE s.latitude IS NOT NULL 
        AND s.longitude IS NOT NULL
        AND s.latitude != 0 
        AND s.longitude != 0
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY girl_count DESC
      LIMIT 10
    `);
    
    // 3. 東京周辺（35.6762, 139.6503）から100km以内のショップ数を確認
    const tokyoNearby = await query(`
      SELECT COUNT(*) as count
      FROM shop_profiles s
      WHERE s.latitude IS NOT NULL 
        AND s.longitude IS NOT NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
        AND (
          6371 * acos(
            cos(radians(35.6762)) * cos(radians(s.latitude)) *
            cos(radians(s.longitude) - radians(139.6503)) +
            sin(radians(35.6762)) * sin(radians(s.latitude))
          )
        ) <= 100
    `);
    
    // 4. 女の子データの統計
    const girlStats = await query(`
      SELECT 
        COUNT(*) as total_girls,
        COUNT(CASE WHEN s.latitude IS NOT NULL AND s.longitude IS NOT NULL THEN 1 END) as with_shop_location
      FROM girl_profiles g
      JOIN shop_profiles s ON g.shop_profile_id = s.id
      WHERE g.is_displayed = 1 AND g.deleted_at IS NULL
    `);
    
    return NextResponse.json({
      success: true,
      statistics: stats[0],
      validShopsSample: validShops,
      tokyoNearbyCount: tokyoNearby[0]?.count || 0,
      girlStatistics: girlStats[0],
      analysis: {
        hasLocationData: (stats[0]?.valid_location || 0) > 0,
        locationCoverage: stats[0]?.total_shops ? 
          ((stats[0]?.valid_location || 0) / stats[0].total_shops * 100).toFixed(2) + '%' : '0%',
        japanBounds: {
          expectedLatRange: [24, 46],  // 日本の緯度範囲
          expectedLonRange: [122, 146], // 日本の経度範囲
          actualLatRange: [stats[0]?.min_lat, stats[0]?.max_lat],
          actualLonRange: [stats[0]?.min_lon, stats[0]?.max_lon],
          isValid: stats[0]?.min_lat >= 24 && stats[0]?.max_lat <= 46 && 
                   stats[0]?.min_lon >= 122 && stats[0]?.max_lon <= 146
        }
      }
    });
    
  } catch (error) {
    console.error('Location data check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check location data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}