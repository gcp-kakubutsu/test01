import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    console.log('=== 店舗と位置情報の関連分析 ===');
    
    // 1. shop_profilesの地域分布を確認
    const shopDistribution = await query(`
      SELECT 
        s.area_prefecture_id,
        p.name as prefecture_name,
        COUNT(s.id) as shop_count,
        COUNT(g.id) as total_girls
      FROM shop_profiles s
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id 
        AND g.is_displayed = 1 
        AND g.deleted_at IS NULL
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
      GROUP BY s.area_prefecture_id
      ORDER BY total_girls DESC
      LIMIT 20
    `);
    
    // 2. 最も女の子が多い店舗のaddress_detailパターンを分析
    const topShops = await query(`
      SELECT 
        s.id,
        s.name,
        s.address_detail,
        s.area_prefecture_id,
        s.area_prefectural_municipality_id,
        COUNT(g.id) as girl_count
      FROM shop_profiles s
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id 
        AND g.is_displayed = 1 
        AND g.deleted_at IS NULL
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
      GROUP BY s.id
      HAVING girl_count > 0
      ORDER BY girl_count DESC
      LIMIT 30
    `);
    
    // 3. area_smallsとshop_profilesの都道府県別マッチング可能性
    const prefectureMatching = await query(`
      SELECT 
        p.id as prefecture_id,
        p.name as prefecture_name,
        COUNT(DISTINCT a.id) as area_small_count,
        COUNT(DISTINCT s.id) as shop_count,
        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') as area_names
      FROM area_prefectures p
      LEFT JOIN area_smalls a ON a.area_prefecture_id = p.id
      LEFT JOIN shop_profiles s ON s.area_prefecture_id = p.id 
        AND s.is_active = 1 
        AND s.deleted_at IS NULL
      GROUP BY p.id
      HAVING shop_count > 0
      ORDER BY shop_count DESC
      LIMIT 10
    `);
    
    // 4. 東京の店舗とarea_smallsの関連を詳細分析
    const tokyoAnalysis = await query(`
      SELECT 
        s.id as shop_id,
        s.name as shop_name,
        s.address_detail,
        COUNT(g.id) as girl_count,
        a.name as area_name,
        a.latitude,
        a.longitude
      FROM shop_profiles s
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id 
        AND g.is_displayed = 1 
        AND g.deleted_at IS NULL
      LEFT JOIN area_smalls a ON a.area_prefecture_id = s.area_prefecture_id
        AND a.id = (
          SELECT id FROM area_smalls 
          WHERE area_prefecture_id = s.area_prefecture_id
          ORDER BY id
          LIMIT 1
        )
      WHERE s.area_prefecture_id = 13  -- 東京
        AND s.is_active = 1 
        AND s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY girl_count DESC
      LIMIT 10
    `);
    
    // 5. 効率的なJOIN方法のテスト - prefecture_idで直接結合
    const startTime = performance.now();
    const efficientJoin = await query(`
      SELECT 
        g.id,
        g.name,
        s.area_prefecture_id,
        COALESCE(
          (SELECT latitude FROM area_smalls 
           WHERE area_prefecture_id = s.area_prefecture_id 
           ORDER BY id LIMIT 1),
          35.6762
        ) as estimated_lat,
        COALESCE(
          (SELECT longitude FROM area_smalls 
           WHERE area_prefecture_id = s.area_prefecture_id 
           ORDER BY id LIMIT 1),
          139.6503
        ) as estimated_lon
      FROM girl_profiles g
      JOIN shop_profiles s ON g.shop_profile_id = s.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      LIMIT 20
    `);
    const queryTime = performance.now() - startTime;
    
    return NextResponse.json({
      success: true,
      shopDistribution,
      topShops: topShops.map((s: any) => ({
        id: s.id,
        name: s.name,
        address: s.address_detail,
        girl_count: s.girl_count,
        prefecture_id: s.area_prefecture_id
      })),
      prefectureMatching: prefectureMatching.map((p: any) => ({
        prefecture_id: p.prefecture_id,
        prefecture_name: p.prefecture_name,
        area_small_count: p.area_small_count,
        shop_count: p.shop_count,
        sample_areas: (p.area_names || '').split(', ').slice(0, 5)
      })),
      tokyoAnalysis,
      performanceTest: {
        queryTime: Math.round(queryTime),
        recordCount: efficientJoin.length
      }
    });
    
  } catch (error) {
    console.error('分析エラー:', error);
    return NextResponse.json(
      { 
        error: '分析に失敗しました',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}