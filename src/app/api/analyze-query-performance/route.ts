import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    const results: any = {};
    
    // 1. インデックスの確認
    console.log('=== インデックス分析 ===');
    
    const shopIndexes = await query(`SHOW INDEX FROM shop_profiles`);
    const girlIndexes = await query(`SHOW INDEX FROM girl_profiles`);
    
    // 2. 各クエリの実行計画を分析
    const explainQueries = [
      {
        name: 'girls_join',
        sql: `EXPLAIN SELECT g.*, s.* FROM girl_profiles g 
              STRAIGHT_JOIN shop_profiles s ON g.shop_profile_id = s.id 
              WHERE g.is_displayed = 1 AND g.deleted_at IS NULL 
              AND s.is_active = 1 AND s.deleted_at IS NULL 
              AND s.area_prefecture_id IN (13, 14, 11) 
              LIMIT 200`
      },
      {
        name: 'girls_optimized',
        sql: `EXPLAIN SELECT g.id, g.name, s.area_prefecture_id 
              FROM girl_profiles g 
              USE INDEX (shop_profile_id) 
              STRAIGHT_JOIN shop_profiles s USE INDEX (PRIMARY) ON g.shop_profile_id = s.id 
              WHERE g.is_displayed = 1 AND g.deleted_at IS NULL 
              AND s.area_prefecture_id = 13 
              LIMIT 200`
      },
      {
        name: 'count_query',
        sql: `EXPLAIN SELECT COUNT(*) FROM girl_profiles g 
              STRAIGHT_JOIN shop_profiles s ON g.shop_profile_id = s.id 
              WHERE g.is_displayed = 1 AND g.deleted_at IS NULL 
              AND s.area_prefecture_id = 13`
      }
    ];
    
    for (const eq of explainQueries) {
      try {
        results[eq.name] = await query(eq.sql);
      } catch (e) {
        results[eq.name] = { error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }
    
    // 3. 実際のクエリパフォーマンスを測定
    const performanceTests = [];
    
    // Test 1: 現在の方法
    const test1Start = performance.now();
    const girls1 = await query(`
      SELECT g.id, g.name, s.area_prefecture_id, s.name as shop_name
      FROM girl_profiles g 
      STRAIGHT_JOIN shop_profiles s ON g.shop_profile_id = s.id 
      WHERE g.is_displayed = 1 AND g.deleted_at IS NULL 
      AND s.is_active = 1 AND s.deleted_at IS NULL 
      AND s.area_prefecture_id = 13 
      LIMIT 200
    `);
    performanceTests.push({
      name: 'current_method',
      time: Math.round(performance.now() - test1Start),
      count: girls1.length
    });
    
    // Test 2: サブクエリを使った方法
    const test2Start = performance.now();
    const girls2 = await query(`
      SELECT g.id, g.name, g.shop_profile_id
      FROM girl_profiles g
      WHERE g.is_displayed = 1 
      AND g.deleted_at IS NULL
      AND g.shop_profile_id IN (
        SELECT id FROM shop_profiles 
        WHERE is_active = 1 
        AND deleted_at IS NULL 
        AND area_prefecture_id = 13
      )
      LIMIT 200
    `);
    performanceTests.push({
      name: 'subquery_method',
      time: Math.round(performance.now() - test2Start),
      count: girls2.length
    });
    
    // Test 3: 単一統合クエリ（すべてのデータを一度に取得）
    const test3Start = performance.now();
    const girls3 = await query(`
      SELECT 
        g.id, g.name, g.age, g.height, g.bust, g.cup,
        s.id as shop_id, s.name as shop_name, s.area_prefecture_id,
        (SELECT image_url FROM girl_image_urls 
         WHERE girl_profile_id = g.id AND image_type = 2 
         ORDER BY sort_order LIMIT 1) as image_url
      FROM girl_profiles g
      STRAIGHT_JOIN shop_profiles s ON g.shop_profile_id = s.id
      WHERE g.is_displayed = 1 
      AND g.deleted_at IS NULL
      AND s.is_active = 1 
      AND s.deleted_at IS NULL
      AND s.area_prefecture_id = 13
      LIMIT 200
    `);
    performanceTests.push({
      name: 'integrated_query',
      time: Math.round(performance.now() - test3Start),
      count: girls3.length
    });
    
    // Test 4: EXISTS を使った方法
    const test4Start = performance.now();
    const girls4 = await query(`
      SELECT g.id, g.name
      FROM girl_profiles g
      WHERE g.is_displayed = 1 
      AND g.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM shop_profiles s
        WHERE s.id = g.shop_profile_id
        AND s.is_active = 1 
        AND s.deleted_at IS NULL 
        AND s.area_prefecture_id = 13
      )
      LIMIT 200
    `);
    performanceTests.push({
      name: 'exists_method',
      time: Math.round(performance.now() - test4Start),
      count: girls4.length
    });
    
    // 4. テーブル統計情報
    const tableStats = await query(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        AVG_ROW_LENGTH,
        DATA_LENGTH,
        INDEX_LENGTH
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('girl_profiles', 'shop_profiles', 'girl_image_urls')
    `);
    
    return NextResponse.json({
      success: true,
      indexes: {
        shop_profiles: shopIndexes.map((idx: any) => ({
          key_name: idx.Key_name,
          column: idx.Column_name,
          cardinality: idx.Cardinality
        })),
        girl_profiles: girlIndexes.map((idx: any) => ({
          key_name: idx.Key_name,
          column: idx.Column_name,
          cardinality: idx.Cardinality
        }))
      },
      explain_results: results,
      performance_tests: performanceTests,
      table_statistics: tableStats,
      recommendations: [
        'サブクエリまたはEXISTSを使用することで、JOINのコストを削減できる可能性',
        '画像URLを統合クエリで取得することで、クエリ数を削減',
        'COUNT(*)クエリを省略し、概算値を使用することで高速化'
      ]
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