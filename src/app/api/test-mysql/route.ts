import { NextResponse } from 'next/server'
import { query } from '@/lib/mysql/db'

export async function GET() {
  try {
    // Test the actual query
    const girls = await query<any>(`
      SELECT 
        g.id,
        g.name,
        g.age,
        g.catch_copy as bio,
        s.name as shop_name,
        COALESCE(p.name, '東京') as location
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      LIMIT 5
    `)
    
    return NextResponse.json({
      count: girls.length,
      data: girls,
      success: true
    })
  } catch (error: any) {
    console.error('Test MySQL error:', error)
    return NextResponse.json({
      error: error.message,
      sql: error.sql,
      code: error.code,
      success: false
    })
  }
}