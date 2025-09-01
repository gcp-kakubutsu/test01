import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET(request: NextRequest) {
  try {
    console.log('=== MySQLデータベース完全調査開始 ===');
    
    // 1. データベース内の全テーブル一覧を取得
    const allTables = await query(
      `SHOW TABLES`
    );
    console.log('全テーブル一覧:', allTables);
    
    // 2. 各テーブルの構造を詳しく調査
    const tableStructures: any = {};
    
    // テーブル名のキーを取得（SHOW TABLESの結果は特殊な形式）
    const tableKey = Object.keys(allTables[0])[0];
    
    for (const table of allTables) {
      const tableName = table[tableKey];
      console.log(`\nテーブル: ${tableName} の構造を調査中...`);
      
      // テーブルの全カラム情報を取得
      const columns = await query(
        `SHOW FULL COLUMNS FROM ${tableName}`
      );
      
      // 緯度・経度に関連しそうなカラムを検索
      const locationColumns = columns.filter((col: any) => {
        const field = col.Field.toLowerCase();
        return field.includes('lat') || 
               field.includes('lng') || 
               field.includes('lon') ||
               field.includes('location') ||
               field.includes('address') ||
               field.includes('area') ||
               field.includes('prefecture') ||
               field.includes('municipality');
      });
      
      tableStructures[tableName] = {
        allColumns: columns.map((col: any) => ({
          field: col.Field,
          type: col.Type,
          null: col.Null,
          key: col.Key,
          default: col.Default
        })),
        locationRelatedColumns: locationColumns,
        hasLocationData: locationColumns.length > 0
      };
    }
    
    // 3. shop_profilesテーブルの詳細データを確認
    const shopProfilesData = await query(
      `SELECT 
        COUNT(*) as total_count,
        COUNT(latitude) as with_latitude,
        COUNT(longitude) as with_longitude,
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lon,
        MAX(longitude) as max_lon
       FROM shop_profiles`
    );
    
    // 4. 実際の位置情報データのサンプル
    const locationSamples = await query(
      `SELECT 
        id, name, 
        latitude, longitude,
        area_prefecture_id,
        area_prefectural_municipality_id,
        address_detail
       FROM shop_profiles 
       WHERE latitude IS NOT NULL 
         AND longitude IS NOT NULL
         AND latitude != 0 
         AND longitude != 0
       LIMIT 10`
    );
    
    // 5. area_prefecturesテーブルの確認
    let areaPrefectures = [];
    try {
      areaPrefectures = await query(
        `SELECT * FROM area_prefectures LIMIT 5`
      );
    } catch (e) {
      console.log('area_prefecturesテーブルの取得エラー:', e);
    }
    
    // 6. area_prefectural_municipalitiesテーブルの確認
    let areaMunicipalities = [];
    try {
      areaMunicipalities = await query(
        `SELECT * FROM area_prefectural_municipalities LIMIT 5`
      );
    } catch (e) {
      console.log('area_prefectural_municipalitiesテーブルの取得エラー:', e);
    }
    
    // 7. girl_profilesとshop_profilesの関連性を確認
    const girlShopRelation = await query(
      `SELECT 
        g.id as girl_id,
        g.name as girl_name,
        g.shop_profile_id,
        s.id as shop_id,
        s.name as shop_name,
        s.latitude,
        s.longitude,
        s.address_detail
       FROM girl_profiles g
       LEFT JOIN shop_profiles s ON g.shop_profile_id = s.id
       WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       LIMIT 5`
    );
    
    // 8. 位置情報を持つデータの分布を確認
    const locationDistribution = await query(
      `SELECT 
        CASE 
          WHEN latitude IS NULL OR longitude IS NULL THEN 'No Location'
          WHEN latitude = 0 AND longitude = 0 THEN 'Zero Location'
          ELSE 'Valid Location'
        END as location_status,
        COUNT(*) as count
       FROM shop_profiles
       GROUP BY location_status`
    );
    
    return NextResponse.json({
      success: true,
      summary: {
        totalTables: allTables.length,
        tablesWithLocationData: Object.keys(tableStructures).filter(
          table => tableStructures[table].hasLocationData
        )
      },
      tableStructures: tableStructures,
      shopProfilesStatistics: shopProfilesData[0],
      locationSamples: locationSamples,
      areaPrefectures: areaPrefectures,
      areaMunicipalities: areaMunicipalities,
      girlShopRelation: girlShopRelation,
      locationDistribution: locationDistribution
    });
    
  } catch (error) {
    console.error('データベース調査エラー:', error);
    return NextResponse.json(
      { 
        error: 'データベース調査に失敗しました',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}