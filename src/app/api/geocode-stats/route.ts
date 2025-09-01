import { NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/geocode-cache';

export async function GET() {
  try {
    const stats = await getCacheStats();
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        description: {
          totalCount: 'Firestore内のキャッシュ総数',
          averageHitCount: '平均ヒット回数',
          mostFrequent: '最もアクセスの多い地域Top10',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'キャッシュ統計の取得に失敗しました' 
      },
      { status: 500 }
    );
  }
}