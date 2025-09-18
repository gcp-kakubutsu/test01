import { NextResponse } from 'next/server'
import { cachedQuery } from '@/lib/mysql/db-optimized'

// Cache area metadata for 10 minutes to avoid expensive repeated aggregation
const PREFECTURE_CACHE_KEY = 'areas:prefectures'
const MUNICIPALITY_CACHE_KEY = 'areas:municipalities'
const PREFECTURE_CACHE_TTL = 1000 * 60 * 10
const MUNICIPALITY_CACHE_TTL = 1000 * 60 * 5

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5

interface PrefectureStat {
  prefecture_id: number
  prefecture_name: string
  girl_count: number
}

interface MunicipalityStat {
  municipality_id: number
  municipality_name: string
  prefecture_name: string
  prefecture_id: number
  full_name: string
  girl_count: number
}

type AreaCachePayload = {
  prefectures: PrefectureStat[]
  municipalities: MunicipalityStat[]
  success: true
}

let inMemoryCache: { expires: number; data: AreaCachePayload } | null = null

export async function GET() {
  try {
    if (inMemoryCache && inMemoryCache.expires > Date.now()) {
      return NextResponse.json(inMemoryCache.data)
    }

    // Prefetch both datasets in parallel with caching to reduce load time
    const [prefectures, municipalities] = await Promise.all([
      cachedQuery<PrefectureStat>(
        `SELECT 
          p.id AS prefecture_id,
          p.name AS prefecture_name,
          COALESCE(stats.girl_count, 0) AS girl_count
        FROM area_prefectures p
        LEFT JOIN (
          SELECT 
            s.area_prefecture_id AS prefecture_id,
            COUNT(DISTINCT g.id) AS girl_count
          FROM shop_profiles s
          INNER JOIN girl_profiles g ON g.shop_profile_id = s.id
          WHERE s.is_active = 1
            AND s.deleted_at IS NULL
            AND g.is_displayed = 1
            AND g.deleted_at IS NULL
            AND s.area_prefecture_id IS NOT NULL
          GROUP BY s.area_prefecture_id
        ) stats ON stats.prefecture_id = p.id
        ORDER BY COALESCE(stats.girl_count, 0) DESC, p.sort_order, p.name`,
        [],
        PREFECTURE_CACHE_KEY,
        PREFECTURE_CACHE_TTL
      ),
      cachedQuery<MunicipalityStat>(
        `SELECT 
          m.id AS municipality_id,
          m.name AS municipality_name,
          p.name AS prefecture_name,
          p.id AS prefecture_id,
          CONCAT(p.name, ' ', m.name) AS full_name,
          COALESCE(stats.girl_count, 0) AS girl_count
        FROM area_prefectural_municipalities m
        INNER JOIN area_prefectures p ON m.area_prefecture_id = p.id
        LEFT JOIN (
          SELECT 
            s.area_prefectural_municipality_id AS municipality_id,
            COUNT(DISTINCT g.id) AS girl_count
          FROM shop_profiles s
          INNER JOIN girl_profiles g ON g.shop_profile_id = s.id
          WHERE s.is_active = 1
            AND s.deleted_at IS NULL
            AND g.is_displayed = 1
            AND g.deleted_at IS NULL
            AND s.area_prefectural_municipality_id IS NOT NULL
          GROUP BY s.area_prefectural_municipality_id
        ) stats ON stats.municipality_id = m.id
        WHERE COALESCE(stats.girl_count, 0) > 0
        ORDER BY COALESCE(stats.girl_count, 0) DESC, p.sort_order, m.name
        LIMIT 300`,
        [],
        MUNICIPALITY_CACHE_KEY,
        MUNICIPALITY_CACHE_TTL
      )
    ])

    const responsePayload: AreaCachePayload = {
      prefectures,
      municipalities,
      success: true
    }

    inMemoryCache = {
      expires: Date.now() + IN_MEMORY_CACHE_TTL,
      data: responsePayload
    }

    return NextResponse.json(responsePayload)

  } catch (error) {
    console.error('Error fetching areas:', error)
    inMemoryCache = null
    return NextResponse.json(
      { error: 'Failed to fetch areas' },
      { status: 500 }
    )
  }
}
