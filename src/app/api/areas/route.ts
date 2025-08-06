import { NextResponse } from 'next/server'
import { query } from '@/lib/mysql/db'

export async function GET() {
  try {
    // Get all prefectures with girl count
    const prefectures = await query<{
      prefecture_id: number
      prefecture_name: string
      girl_count: number
    }>(
      `SELECT 
        p.id as prefecture_id,
        p.name as prefecture_name,
        COALESCE(COUNT(DISTINCT g.id), 0) as girl_count
      FROM area_prefectures p
      LEFT JOIN shop_profiles s ON s.area_prefecture_id = p.id AND s.is_active = 1 AND s.deleted_at IS NULL
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id AND g.is_displayed = 1 AND g.deleted_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY girl_count DESC, p.sort_order, p.name`
    )
    
    // Also get popular municipalities (cities) with significant number of girls
    const municipalities = await query<{
      municipality_id: number
      municipality_name: string
      prefecture_name: string
      prefecture_id: number
      full_name: string
      girl_count: number
    }>(
      `SELECT DISTINCT 
        m.id as municipality_id,
        m.name as municipality_name,
        p.name as prefecture_name,
        p.id as prefecture_id,
        CONCAT(p.name, ' ', m.name) as full_name,
        COUNT(DISTINCT g.id) as girl_count
      FROM area_prefectural_municipalities m
      INNER JOIN area_prefectures p ON m.area_prefecture_id = p.id
      LEFT JOIN shop_profiles s ON s.area_prefectural_municipality_id = m.id AND s.is_active = 1 AND s.deleted_at IS NULL
      LEFT JOIN girl_profiles g ON g.shop_profile_id = s.id AND g.is_displayed = 1 AND g.deleted_at IS NULL
      GROUP BY m.id, m.name, p.name, p.id
      ORDER BY girl_count DESC, p.sort_order, m.name`
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