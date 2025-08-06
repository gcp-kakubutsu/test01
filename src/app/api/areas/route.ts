import { NextResponse } from 'next/server'
import { query } from '@/lib/mysql/db'

export async function GET() {
  try {
    // Get unique prefectures where active girls exist
    const prefectures = await query<{
      prefecture_id: number
      prefecture_name: string
      girl_count: number
    }>(
      `SELECT DISTINCT 
        p.id as prefecture_id,
        p.name as prefecture_name,
        COUNT(DISTINCT g.id) as girl_count
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      INNER JOIN area_prefectures p ON s.area_prefecture_id = p.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      GROUP BY p.id, p.name
      HAVING girl_count > 0
      ORDER BY p.sort_order, p.name`
    )
    
    // Also get popular municipalities (cities) with significant number of girls
    const municipalities = await query<{
      municipality_id: number
      municipality_name: string
      prefecture_name: string
      full_name: string
      girl_count: number
    }>(
      `SELECT DISTINCT 
        m.id as municipality_id,
        m.name as municipality_name,
        p.name as prefecture_name,
        CONCAT(p.name, ' ', m.name) as full_name,
        COUNT(DISTINCT g.id) as girl_count
      FROM girl_profiles g
      INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
      INNER JOIN area_prefectures p ON s.area_prefecture_id = p.id
      INNER JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
      WHERE g.is_displayed = 1 
        AND g.deleted_at IS NULL
        AND s.is_active = 1
        AND s.deleted_at IS NULL
      GROUP BY m.id, m.name, p.name
      HAVING girl_count >= 1
      ORDER BY girl_count DESC
      LIMIT 30`
    )
    
    return NextResponse.json({
      prefectures,
      municipalities,
      success: true
    })
    
  } catch (error) {
    console.error('Error fetching areas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch areas' },
      { status: 500 }
    )
  }
}