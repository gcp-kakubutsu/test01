import { NextResponse } from 'next/server';
import { fetchOptimizedGirls } from '@/lib/mysql/girls-optimized';
import { cachedUltraSort } from '@/lib/utils/optimizedSorting';

export async function GET() {
  // テスト用の東京駅の座標
  const testLat = 35.6812;
  const testLng = 139.7671;
  const limit = 200;
  
  console.log('🧪 ===== 複数回パフォーマンステスト開始 =====');
  console.log(`📍 テスト位置: 東京駅 (${testLat}, ${testLng})`);
  
  const testRuns = 5; // 5回テスト実行
  const oldMethodTimes: number[] = [];
  const newMethodTimes: number[] = [];
  
  try {
    for (let i = 0; i < testRuns; i++) {
      console.log(`\n📊 テスト ${i + 1}/${testRuns}`);
      
      // ============ 改善前（クライアント側ソート）============
      const oldMethodStart = performance.now();
      
      // 位置情報なしで取得（従来の方法）
      const { girls: oldGirls } = await fetchOptimizedGirls(
        limit, 0, null, 18, 50, null, null, null, null, null
      );
      
      // クライアント側でソート
      const sortedOldGirls = cachedUltraSort(
        oldGirls as any[],
        testLat,
        testLng,
        limit
      );
      
      const oldMethodTime = performance.now() - oldMethodStart;
      oldMethodTimes.push(oldMethodTime);
      console.log(`  改善前: ${oldMethodTime.toFixed(2)}ms`);
      
      // ============ 改善後（MySQL側ソート + area_smalls）============
      const newMethodStart = performance.now();
      
      // 位置情報付きで取得（area_smallsの位置を使用）
      const { girls: newGirls } = await fetchOptimizedGirls(
        limit, 0, null, 18, 50, null, null, testLat, testLng, null
      );
      
      const newMethodTime = performance.now() - newMethodStart;
      newMethodTimes.push(newMethodTime);
      console.log(`  改善後: ${newMethodTime.toFixed(2)}ms`);
      
      // キャッシュクリアのため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 統計計算
    const calcStats = (times: number[]) => ({
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
    });
    
    const oldStats = calcStats(oldMethodTimes);
    const newStats = calcStats(newMethodTimes);
    
    const improvement = ((oldStats.avg - newStats.avg) / oldStats.avg * 100).toFixed(1);
    const speedUp = (oldStats.avg / newStats.avg).toFixed(2);
    
    console.log('\n🎯 ===== パフォーマンステスト結果サマリー =====');
    console.log(`📈 改善前平均: ${oldStats.avg.toFixed(2)}ms`);
    console.log(`📈 改善後平均: ${newStats.avg.toFixed(2)}ms`);
    console.log(`✨ 改善率: ${improvement}%`);
    console.log(`⚡ 速度: ${speedUp}倍速`);
    
    return NextResponse.json({
      success: true,
      testRuns,
      oldMethod: {
        times: oldMethodTimes.map(t => t.toFixed(2)),
        stats: {
          min: oldStats.min.toFixed(2),
          max: oldStats.max.toFixed(2),
          avg: oldStats.avg.toFixed(2),
          median: oldStats.median.toFixed(2)
        }
      },
      newMethod: {
        times: newMethodTimes.map(t => t.toFixed(2)),
        stats: {
          min: newStats.min.toFixed(2),
          max: newStats.max.toFixed(2),
          avg: newStats.avg.toFixed(2),
          median: newStats.median.toFixed(2)
        }
      },
      improvement: {
        percentage: improvement,
        speedUp,
        avgTimeSaved: (oldStats.avg - newStats.avg).toFixed(2)
      },
      summary: `area_smallsの位置情報を活用することで、平均${improvement}%（${speedUp}倍）の速度改善を達成`
    });
    
  } catch (error: any) {
    console.error('❌ テストエラー:', error);
    return NextResponse.json(
      { error: 'Performance test failed', details: error.message },
      { status: 500 }
    );
  }
}