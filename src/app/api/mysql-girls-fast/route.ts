import { NextRequest, NextResponse } from 'next/server';
import { fetchOptimizedGirls, prefetchNextPage } from '@/lib/mysql/girls-optimized';
import { getPerformanceMetrics } from '@/lib/mysql/db-optimized';
import { fetchMySQLGirls } from '@/lib/mysql/girls';
import { LRUCache } from 'lru-cache';

// Enable edge runtime for better performance
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate cache every 60 seconds

const HOT_RESPONSE_TTL_MS = 1000;
const hotResponseCache = new LRUCache<string, { body: any; headers: Record<string, string> }>({
  max: 200,
  ttl: HOT_RESPONSE_TTL_MS,
});

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const searchParams = request.nextUrl.searchParams;
  const requestedLimit = parseInt(searchParams.get('limit') || '20');
  const limit = Number.isNaN(requestedLimit) ? 20 : Math.min(requestedLimit, 50);
  const offset = parseInt(searchParams.get('offset') || '0');
  const area = searchParams.get('area') || null;
  const ageMinParam = parseInt(searchParams.get('ageMin') || '18');
  const ageMin = isNaN(ageMinParam) ? 18 : ageMinParam;
  const ageMaxParam = parseInt(searchParams.get('ageMax') || '50');
  const ageMax = isNaN(ageMaxParam) ? 50 : ageMaxParam;
  const girlTypesParam = searchParams.get('girlTypes');
  const girlTypes = girlTypesParam ? girlTypesParam.split(',') : null;
  const girlId = searchParams.get('girlId') || null;
  const userLat = searchParams.get('userLat') ? parseFloat(searchParams.get('userLat')!) : null;
  const userLng = searchParams.get('userLng') ? parseFloat(searchParams.get('userLng')!) : null;
  const maxDistance = searchParams.get('maxDistance') ? parseInt(searchParams.get('maxDistance')!) : null;
  const recordingDuringPlay = searchParams.get('recordingDuringPlay') || null;
  const isSadist = searchParams.get('isSadist') || null;
  const isMasochist = searchParams.get('isMasochist') || null;
  const partnerHeight = searchParams.get('partnerHeight') || null;
  const partnerWeight = searchParams.get('partnerWeight') || null;
  const partnerLocation = searchParams.get('partnerLocation') || null;
  const cosplayPreference = searchParams.get('cosplayPreference') ? parseInt(searchParams.get('cosplayPreference')!) : null;
  const toyPlayPreference = searchParams.get('toyPlayPreference') ? parseInt(searchParams.get('toyPlayPreference')!) : null;
  const deepthroatPreference = searchParams.get('deepthroatPreference') ? parseInt(searchParams.get('deepthroatPreference')!) : null;
  const throatingPreference = searchParams.get('throatingPreference') ? parseInt(searchParams.get('throatingPreference')!) : null;
  const analPlayPreference = searchParams.get('analPlayPreference') ? parseInt(searchParams.get('analPlayPreference')!) : null;
  const groupPlayPreference = searchParams.get('groupPlayPreference') ? parseInt(searchParams.get('groupPlayPreference')!) : null;
  const preferredGirlTypeIdsParam = searchParams.get('preferredGirlTypeIds');
  const preferredGirlTypeIds = preferredGirlTypeIdsParam ? preferredGirlTypeIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : null;
  const preferredBodyTypesParam = searchParams.get('preferredBodyTypes');
  const preferredBodyTypes = preferredBodyTypesParam ? preferredBodyTypesParam.split(',') : null;
  const scheduleDateParam = searchParams.get('scheduleDate');
  const scheduleDate = scheduleDateParam ? scheduleDateParam.trim() : 'today';
  const scheduleRangeParam = parseInt(searchParams.get('scheduleRangeDays') || '0');
  const scheduleRangeDays = !Number.isNaN(scheduleRangeParam) && scheduleRangeParam > 0
    ? Math.min(scheduleRangeParam, 14)
    : null;

  if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0 || ageMin < 0 || ageMax < 0 || ageMin > ageMax) {
    console.error('Invalid parameters:', { limit, offset, ageMin, ageMax });
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const girlTypesKey = girlTypes?.join(',') || '';
  const preferredGirlTypesKey = preferredGirlTypeIds?.join(',') || '';
  const preferredBodyTypesKey = preferredBodyTypes?.join(',') || '';
  const cacheKeyBase = [
    limit,
    offset,
    area || 'all',
    ageMin,
    ageMax,
    girlTypesKey,
    userLat ? userLat.toFixed(2) : 'na',
    userLng ? userLng.toFixed(2) : 'na',
    maxDistance ?? 'na',
    recordingDuringPlay || 'na',
    isSadist || 'na',
    isMasochist || 'na',
    partnerHeight || 'na',
    partnerWeight || 'na',
    partnerLocation || 'na',
    cosplayPreference ?? 'na',
    toyPlayPreference ?? 'na',
    deepthroatPreference ?? 'na',
    throatingPreference ?? 'na',
    analPlayPreference ?? 'na',
    groupPlayPreference ?? 'na',
    preferredGirlTypesKey,
    preferredBodyTypesKey,
    scheduleDate || 'na',
    scheduleRangeDays ?? 'na'
  ].join(':');

  const isHotCacheable =
    limit <= 20 &&
    offset % limit === 0 &&
    scheduleDate === 'today';

  const responseCacheKey = isHotCacheable ? `resp:${cacheKeyBase}` : null;

  if (responseCacheKey) {
    const cached = hotResponseCache.get(responseCacheKey);
    if (cached) {
      const cachedResponse = NextResponse.json(cached.body);
      Object.entries(cached.headers).forEach(([key, value]) => cachedResponse.headers.set(key, value));
      cachedResponse.headers.set('X-Cache', 'HIT');
      return cachedResponse;
    }
  }

  try {
    // Fetch optimized data with location-based sorting
    const { girls, total, prefectureFilter } = await fetchOptimizedGirls(
      limit,
      offset,
      area,
      ageMin,
      ageMax,
      girlTypes,
      girlId,
      userLat,
      userLng,
      maxDistance,
      recordingDuringPlay,
      isSadist,
      isMasochist,
      partnerHeight,
      partnerWeight,
      partnerLocation,
      cosplayPreference,
      toyPlayPreference,
      deepthroatPreference,
      throatingPreference,
      analPlayPreference,
      groupPlayPreference,
      preferredGirlTypeIds,
      preferredBodyTypes,
      scheduleDate,
      scheduleRangeDays
    );
    
    // Prefetch next page in background
    if (offset + limit < total) {
      prefetchNextPage(offset, limit, area, ageMin, ageMax, girlTypes, girlId, userLat, userLng, maxDistance, recordingDuringPlay, isSadist, isMasochist, partnerHeight, partnerWeight, partnerLocation, cosplayPreference, toyPlayPreference, deepthroatPreference, throatingPreference, analPlayPreference, groupPlayPreference, preferredGirlTypeIds, preferredBodyTypes, scheduleDate, scheduleRangeDays);
    }
    
    const responseTime = performance.now() - startTime;
    
    // Get performance metrics
    const metrics = getPerformanceMetrics();
    
    // Create response with optimized headers
    const responsePayload = {
      girls,
      total,
      limit,
      offset,
      success: true,
      prefectureFilter,
      performance: {
        responseTime: Math.round(responseTime),
        cacheHitRate: metrics.cacheHitRate.toFixed(2),
        averageQueryTime: Math.round(metrics.averageQueryTime)
      }
    };

    const response = NextResponse.json(responsePayload);
    
    // Add cache headers for CDN
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    response.headers.set('CDN-Cache-Control', 'max-age=300');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Note: Content-Encoding is handled automatically by Next.js
    
    console.log(`✅ Fast API Response: ${responseTime.toFixed(2)}ms for ${girls.length} girls`);

    if (responseCacheKey) {
      hotResponseCache.set(responseCacheKey, {
        body: responsePayload,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'CDN-Cache-Control': 'max-age=300',
          'X-Response-Time': `${responseTime}ms`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      response.headers.set('X-Cache', 'MISS');
    }
    
    return response;
  } catch (error: any) {
    const responseTime = performance.now() - startTime;
    console.error('❌ Error in fast API:', error);
    
    try {
      const fallbackGirls = await fetchMySQLGirls(limit, offset, area, ageMin, ageMax);
      const fallbackResponse = NextResponse.json({
        girls: fallbackGirls,
        total: fallbackGirls.length + offset,
        limit,
        offset,
        success: true,
        fallback: true,
        performance: {
          responseTime: Math.round(responseTime),
        }
      });

      fallbackResponse.headers.set('Cache-Control', 'private, max-age=10');
      fallbackResponse.headers.set('X-Response-Time', `${responseTime}ms`);

      console.warn(`⚠️ Fallback response used: ${responseTime.toFixed(2)}ms for ${fallbackGirls.length} girls`);

      return fallbackResponse;
    } catch (fallbackError: any) {
      console.error('❌ Fallback query also failed:', fallbackError);
      return NextResponse.json(
        {
          error: 'Failed to fetch girls',
          details: fallbackError.message || error.message,
          responseTime: Math.round(responseTime)
        },
        { status: 500 }
      );
    }
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

// Prefetch popular queries on server start
// Warm-up function for cache priming (not exported to avoid Next.js type issues)
type WarmUpQuery = {
  limit: number;
  offset: number;
  area: string | null;
  ageMin?: number;
  ageMax?: number;
  girlTypes?: string[];
  userLat?: number;
  userLng?: number;
  maxDistance?: number;
  scheduleDate?: string | null;
};

async function warmUp() {
  const popularQueries: WarmUpQuery[] = [
    { limit: 20, offset: 0, area: null, userLat: 35.68, userLng: 139.76, maxDistance: 80, scheduleDate: 'today' },
    { limit: 20, offset: 0, area: '東京都', scheduleDate: 'today' },
    { limit: 20, offset: 0, area: '大阪府', scheduleDate: 'today' },
    { limit: 20, offset: 0, area: '愛知県', scheduleDate: 'today' },
    { limit: 20, offset: 0, area: null, userLat: 34.69, userLng: 135.5, maxDistance: 80, scheduleDate: 'today' },
  ];
  
  console.log('🔥 Warming up cache with popular queries...');
  
  for (const query of popularQueries) {
    fetchOptimizedGirls(
      query.limit,
      query.offset,
      query.area,
      query.ageMin,
      query.ageMax,
      query.girlTypes,
      undefined,
      query.userLat,
      query.userLng,
      query.maxDistance,
      undefined, // recordingDuringPlay
      undefined, // isSadist
      undefined, // isMasochist
      undefined, // partnerHeight
      undefined, // partnerWeight
      undefined, // partnerLocation
      undefined, // cosplayPreference
      undefined, // toyPlayPreference
      undefined, // deepthroatPreference
      undefined, // throatingPreference
      undefined, // analPlayPreference
      undefined, // groupPlayPreference
      undefined, // preferredGirlTypeIds
      undefined, // preferredBodyTypes
      query.scheduleDate
    ).catch(error => console.error('⚠️  Warm-up query failed:', error));
  }
}

warmUp().catch(error => console.error('⚠️  Failed to warm up popular search cache:', error));
