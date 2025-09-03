import { NextRequest, NextResponse } from 'next/server';
import { fetchOptimizedGirls, prefetchNextPage } from '@/lib/mysql/girls-optimized';
import { getPerformanceMetrics } from '@/lib/mysql/db-optimized';

// Enable edge runtime for better performance
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate cache every 60 seconds

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000); // 上限を1000に変更
    const offset = parseInt(searchParams.get('offset') || '0');
    const area = searchParams.get('area') || null;
    const ageMin = parseInt(searchParams.get('ageMin') || '18');
    const ageMax = parseInt(searchParams.get('ageMax') || '50');
    const girlTypesParam = searchParams.get('girlTypes');
    const girlTypes = girlTypesParam ? girlTypesParam.split(',') : null;
    const girlId = searchParams.get('girlId') || null;
    
    // 位置情報パラメータを追加
    const userLat = searchParams.get('userLat') ? parseFloat(searchParams.get('userLat')!) : null;
    const userLng = searchParams.get('userLng') ? parseFloat(searchParams.get('userLng')!) : null;
    const maxDistance = searchParams.get('maxDistance') ? parseInt(searchParams.get('maxDistance')!) : null; // km単位
    
    // ユーザー設定パラメータを追加
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
    
    // 女の子タイプと体型の嗜好
    const preferredGirlTypeIdsParam = searchParams.get('preferredGirlTypeIds');
    const preferredGirlTypeIds = preferredGirlTypeIdsParam ? preferredGirlTypeIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : null;
    const preferredBodyTypesParam = searchParams.get('preferredBodyTypes');
    const preferredBodyTypes = preferredBodyTypesParam ? preferredBodyTypesParam.split(',') : null;
    
    // Validate parameters
    if (isNaN(limit) || isNaN(offset) || isNaN(ageMin) || isNaN(ageMax)) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
    
    // Fetch optimized data with location-based sorting
    const { girls, total } = await fetchOptimizedGirls(
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
      preferredBodyTypes
    );
    
    // Prefetch next page in background
    if (offset + limit < total) {
      prefetchNextPage(offset, limit, area, ageMin, ageMax, girlTypes, girlId, userLat, userLng, maxDistance, recordingDuringPlay, isSadist, isMasochist, partnerHeight, partnerWeight, partnerLocation, cosplayPreference, toyPlayPreference, deepthroatPreference, throatingPreference, analPlayPreference, groupPlayPreference, preferredGirlTypeIds, preferredBodyTypes);
    }
    
    const responseTime = performance.now() - startTime;
    
    // Get performance metrics
    const metrics = getPerformanceMetrics();
    
    // Create response with optimized headers
    const response = NextResponse.json({
      girls,
      total,
      limit,
      offset,
      success: true,
      performance: {
        responseTime: Math.round(responseTime),
        cacheHitRate: metrics.cacheHitRate.toFixed(2),
        averageQueryTime: Math.round(metrics.averageQueryTime)
      }
    });
    
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
    
    return response;
  } catch (error: any) {
    const responseTime = performance.now() - startTime;
    console.error('❌ Error in fast API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch girls',
        details: error.message,
        responseTime: Math.round(responseTime)
      },
      { status: 500 }
    );
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
async function warmUp() {
  const popularQueries = [
    { limit: 200, offset: 0, area: null },
    { limit: 200, offset: 0, area: '東京都' },
    { limit: 200, offset: 0, area: '大阪府' },
    { limit: 200, offset: 0, area: '愛知県' },
  ];
  
  console.log('🔥 Warming up cache with popular queries...');
  
  for (const query of popularQueries) {
    fetchOptimizedGirls(query.limit, query.offset, query.area);
  }
}