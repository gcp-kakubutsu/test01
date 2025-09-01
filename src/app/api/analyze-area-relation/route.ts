import { NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/mysql/db-optimized';

export async function GET() {
  const db = await getOptimizedDb();
  
  try {
    console.log('🔍 area関連テーブルの関係を分析中...');
    
    // area_smallsテーブルの構造とデータを確認
    const [areaSmallsInfo] = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT area_prefectural_municipality_id) as unique_municipality_ids,
        COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as with_location,
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lng,
        MAX(longitude) as max_lng
      FROM area_smalls
    `);
    
    // area_smallsのサンプルデータ
    const [areaSmallsSample] = await db.query(`
      SELECT id, name, area_prefectural_municipality_id, latitude, longitude
      FROM area_smalls
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 5
    `);
    
    // shop_profilesとarea_smallsをarea_prefectural_municipality_idで結合
    const [joinTest] = await db.query(`
      SELECT 
        COUNT(DISTINCT s.id) as shops_matched,
        COUNT(DISTINCT a.id) as areas_matched
      FROM shop_profiles s
      INNER JOIN area_smalls a ON s.area_prefectural_municipality_id = a.area_prefectural_municipality_id
      WHERE s.is_active = 1 
        AND s.deleted_at IS NULL
        AND a.latitude IS NOT NULL 
        AND a.longitude IS NOT NULL
    `);
    
    // 具体的な結合例
    const [joinExample] = await db.query(`
      SELECT 
        s.id as shop_id,
        s.name as shop_name,
        s.area_prefectural_municipality_id,
        a.id as area_small_id,
        a.name as area_name,
        a.latitude,
        a.longitude
      FROM shop_profiles s
      INNER JOIN area_smalls a ON s.area_prefectural_municipality_id = a.area_prefectural_municipality_id
      WHERE s.is_active = 1 
        AND s.deleted_at IS NULL
        AND a.latitude IS NOT NULL 
        AND a.longitude IS NOT NULL
      LIMIT 10
    `);
    
    // 東京駅からの距離計算テスト（area_smallsの位置情報を使用）
    const testLat = 35.6812;
    const testLng = 139.7671;
    
    const [distanceTest] = await db.query(`
      SELECT 
        g.id,
        g.name,
        s.name as shop_name,
        a.name as area_name,
        a.latitude,
        a.longitude,
        ST_Distance_Sphere(
          POINT(a.longitude, a.latitude), 
          POINT(${testLng}, ${testLat})
        ) / 1000 as distance_km
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      INNER JOIN area_smalls a ON s.area_prefectural_municipality_id = a.area_prefectural_municipality_id
      WHERE g.is_displayed = 1
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
        AND a.latitude IS NOT NULL 
        AND a.longitude IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 10
    `);
    
    // パフォーマンス比較用：area_smallsを使った場合のカバレッジ
    const [coverage] = await db.query(`
      SELECT 
        COUNT(DISTINCT g.id) as total_girls,
        COUNT(DISTINCT CASE 
          WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL 
          THEN g.id 
        END) as girls_with_location_via_area
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_smalls a ON s.area_prefectural_municipality_id = a.area_prefectural_municipality_id
      WHERE g.is_displayed = 1
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
    `);
    
    return NextResponse.json({
      areaSmallsInfo: areaSmallsInfo[0],
      areaSmallsSample,
      joinTest: joinTest[0],
      joinExample,
      distanceTest,
      coverage: coverage[0],
      summary: {
        canUseAreaSmallsLocation: (joinTest[0] as any).shops_matched > 0,
        locationCoverage: coverage[0] ? 
          (((coverage[0] as any).girls_with_location_via_area / (coverage[0] as any).total_girls * 100).toFixed(1) + '%') : 
          '0%',
        hasWorkingDistanceCalc: distanceTest.length > 0
      }
    });
    
  } catch (error: any) {
    console.error('Error analyzing area relation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze area relation', details: error.message },
      { status: 500 }
    );
  }
}