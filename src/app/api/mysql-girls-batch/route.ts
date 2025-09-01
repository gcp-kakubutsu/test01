import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('=== Batch API: Start ===');
  
  try {
    // リクエストボディを解析
    const body = await request.json();
    const { girlIds } = body;
    console.log('Batch API: Received IDs:', girlIds);
    
    if (!girlIds || !Array.isArray(girlIds) || girlIds.length === 0) {
      return NextResponse.json(
        { error: 'girlIds array is required' },
        { status: 400 }
      );
    }
    
    // IDをクリーンアップ
    const processedIds = girlIds.map(id => {
      const cleanId = typeof id === 'string' && id.startsWith('mysql_girl_') 
        ? id.replace('mysql_girl_', '') 
        : id;
      return cleanId.toString();
    });
    console.log('Batch API: Processed IDs:', processedIds);
    
    // fetchOptimizedGirlsを動的インポート
    let fetchOptimizedGirls;
    try {
      const girlsModule = await import('@/lib/mysql/girls-optimized');
      fetchOptimizedGirls = girlsModule.fetchOptimizedGirls;
      console.log('Batch API: Module imported successfully');
    } catch (importError: any) {
      console.error('Batch API: Import error:', importError);
      throw new Error(`Failed to import module: ${importError.message}`);
    }
    
    // 各IDに対して個別に取得（動作確認済みの方法）
    const results = [];
    for (const girlId of processedIds) {
      try {
        console.log(`Batch API: Fetching girl ${girlId}...`);
        const result = await fetchOptimizedGirls(
          1,      // limit
          0,      // offset
          null,   // area
          18,     // ageMin
          50,     // ageMax
          null,   // girlTypes
          girlId, // girlId
          null,   // userLat
          null,   // userLng
          null    // maxDistance
        );
        
        if (result && result.girls && result.girls.length > 0) {
          const girl = result.girls[0];
          results.push({
            id: girl.id,
            name: girl.name || '',
            location: girl.location || girl.municipality || '',
            municipality: girl.municipality || ''
          });
          console.log(`Batch API: Successfully fetched girl ${girlId}`);
        } else {
          console.log(`Batch API: No data for girl ${girlId}`);
        }
      } catch (fetchError: any) {
        console.error(`Batch API: Error fetching girl ${girlId}:`, fetchError.message);
      }
    }
    
    console.log(`=== Batch API: Success - Fetched ${results.length}/${processedIds.length} girls ===`);
    
    return NextResponse.json({
      girls: results,
      total: results.length
    });
    
  } catch (error: any) {
    console.error('=== Batch API: Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error occurred',
        type: error.constructor.name
      },
      { status: 500 }
    );
  }
}