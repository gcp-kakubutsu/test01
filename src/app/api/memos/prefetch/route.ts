import { NextRequest, NextResponse } from 'next/server';

// メモリキャッシュ（30秒間保持）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30秒

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    // キャッシュチェック
    const cacheKey = `memos_${userId}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ 
        success: true, 
        cached: true,
        timestamp: cached.timestamp 
      });
    }
    
    // バックグラウンドでデータをプリフェッチ（実際のデータ取得はしない）
    // クライアント側のFirebaseアクセスを高速化するため、
    // ここではキャッシュヒントを設定するのみ
    
    cache.set(cacheKey, {
      data: { prefetched: true },
      timestamp: Date.now()
    });
    
    // レスポンスヘッダーでキャッシュを促進
    const response = NextResponse.json({ 
      success: true, 
      cached: false,
      timestamp: Date.now()
    });
    
    response.headers.set('Cache-Control', 'private, max-age=30');
    
    return response;
  } catch (error) {
    console.error('Prefetch error:', error);
    return NextResponse.json({ error: 'Prefetch failed' }, { status: 500 });
  }
}