/**
 * 超高速最適化ソート処理
 * 最小限の計算で最大のパフォーマンス
 */

interface SortableGirl {
  id: number;
  name: string;
  age?: number;
  location?: string;
  shop?: {
    latitude?: number;
    longitude?: number;
    area_prefecture_id?: number;
  };
  created_at?: string;
  distance_km?: number;
  score?: number;
  _sortKey?: number; // 事前計算されたソートキー
}

interface UserPreferences {
  ageMin?: number;
  ageMax?: number;
  preferredLocation?: string;
  userLat?: number;
  userLon?: number;
}

// 超簡易距離計算（平方根なし）
function fastDistanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lat2 - lat1) * 111;
  const dy = (lon2 - lon1) * 91;
  return dx * dx + dy * dy; // 平方根計算をスキップ
}

// 都道府県ごとの代表座標（キャッシュ）
const PREFECTURE_COORDS: { [key: number]: [number, number] } = {
  13: [35.6762, 139.6503], // 東京
  14: [35.4437, 139.6380], // 神奈川
  11: [35.8617, 139.6455], // 埼玉
  12: [35.6073, 140.1064], // 千葉
  27: [34.6937, 135.5023], // 大阪
  23: [35.1815, 136.9066], // 愛知
  26: [35.0116, 135.7681], // 京都
  28: [34.6901, 135.1955], // 兵庫
  40: [33.5904, 130.4017], // 福岡
};

/**
 * 超高速スコアリング関数（整数演算のみ）
 * 最小限の計算で最大のパフォーマンス
 */
export function ultraFastScore(
  girl: SortableGirl,
  userLat?: number,
  userLon?: number
): number {
  // 事前計算されたキーがあれば即座に返す
  if (girl._sortKey !== undefined) {
    return girl._sortKey;
  }
  
  let score = 10000; // 整数で計算（小数点なし）
  
  // 距離スコア（最も重要・簡略化）
  if (userLat && userLon && girl.shop?.area_prefecture_id) {
    const coords = PREFECTURE_COORDS[girl.shop.area_prefecture_id];
    if (coords) {
      // 平方根を計算しない簡易距離
      const distSq = fastDistanceSquared(userLat, userLon, coords[0], coords[1]);
      
      // 簡略化された距離スコア（分岐を減らす）
      if (distSq < 625) score += 5000;      // ~25km^2
      else if (distSq < 2500) score += 2000; // ~50km^2
      else if (distSq < 10000) score += 500; // ~100km^2
    }
  }
  
  // 新着ボーナス（簡略化）
  if (girl.created_at) {
    const hoursSince = (Date.now() - new Date(girl.created_at).getTime()) / 3600000;
    if (hoursSince < 24) score += 3000;
    else if (hoursSince < 72) score += 1000;
  }
  
  // 結果をキャッシュ
  girl._sortKey = score;
  return score;
}

/**
 * ウルトラ高速ソート（インプレース処理）
 * - 最小限のメモリアロケーション
 * - 事前計算されたスコアを活用
 * - 早期終了最適化
 */
export function ultraFastSort(
  girls: SortableGirl[],
  userLat?: number,
  userLon?: number,
  limit: number = 200
): SortableGirl[] {
  const startTime = performance.now();
  
  // インプレースでスコア計算（コピーなし）
  const len = Math.min(girls.length, limit * 2);
  for (let i = 0; i < len; i++) {
    girls[i]._sortKey = ultraFastScore(girls[i], userLat, userLon);
  }
  
  // 部分ソート（上位limit件のみ）- O(n*limit)で十分
  for (let i = 0; i < Math.min(limit, len); i++) {
    let maxIdx = i;
    let maxScore = girls[i]._sortKey || 0;
    
    for (let j = i + 1; j < len; j++) {
      const score = girls[j]._sortKey || 0;
      if (score > maxScore) {
        maxScore = score;
        maxIdx = j;
      }
    }
    
    if (maxIdx !== i) {
      // スワップ（オブジェクト参照のみ）
      const temp = girls[i];
      girls[i] = girls[maxIdx];
      girls[maxIdx] = temp;
    }
  }
  
  const endTime = performance.now();
  console.log(`⚡⚡ Ultra fast sort: ${(endTime - startTime).toFixed(2)}ms`);
  
  return girls.slice(0, limit);
}

/**
 * スコア計算関数
 */
function calculateGirlScore(girl: SortableGirl, preferences: UserPreferences): number {
  let score = 0;
  
  // 年齢スコア
  if (girl.age && preferences.ageMin && preferences.ageMax) {
    if (girl.age >= preferences.ageMin && girl.age <= preferences.ageMax) {
      score += 100;
    }
  }
  
  // 距離スコア（既に計算済みの場合）
  if (girl.distance_km) {
    score += Math.max(0, 100 - girl.distance_km);
  }
  
  // 位置情報スコア
  if (preferences.userLat && preferences.userLon && girl.shop) {
    if (girl.shop.latitude && girl.shop.longitude) {
      const distSq = fastDistanceSquared(
        preferences.userLat,
        preferences.userLon,
        girl.shop.latitude,
        girl.shop.longitude
      );
      score += Math.max(0, 1000 - distSq);
    }
  }
  
  return score;
}

/**
 * バッチ処理版（大量データ用）
 * チャンクに分けて処理することで、UIをブロックしない
 */
export async function batchOptimizedSort(
  girls: SortableGirl[],
  preferences: UserPreferences,
  chunkSize: number = 50
): Promise<SortableGirl[]> {
  const chunks: SortableGirl[][] = [];
  
  // データをチャンクに分割
  for (let i = 0; i < girls.length; i += chunkSize) {
    chunks.push(girls.slice(i, i + chunkSize));
  }
  
  // 各チャンクを処理
  const processedChunks: SortableGirl[][] = [];
  for (const chunk of chunks) {
    const scored = chunk.map(girl => ({
      ...girl,
      score: calculateGirlScore(girl, preferences)
    }));
    processedChunks.push(scored);
    
    // UIスレッドに制御を返す
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // 全チャンクを結合してソート
  const allGirls = processedChunks.flat();
  allGirls.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return allGirls;
}

/**
 * ウルトラキャッシュ付き高速ソート
 * WeakMapでメモリ効率も最適化
 */
const ultraCache = new Map<string, SortableGirl[]>();
let lastGirlsRef: SortableGirl[] | null = null;
let lastSortedResult: SortableGirl[] | null = null;

export function cachedUltraSort(
  girls: SortableGirl[],
  userLat?: number,
  userLon?: number,
  limit: number = 200
): SortableGirl[] {
  // 超高速キャッシュチェック（参照比較）
  if (lastGirlsRef === girls && lastSortedResult) {
    console.log('⚡⚡⚡ Ultra cache hit!');
    return lastSortedResult;
  }
  
  // ソート実行
  const sorted = ultraFastSort([...girls], userLat, userLon, limit);
  
  // キャッシュ更新
  lastGirlsRef = girls;
  lastSortedResult = sorted;
  
  return sorted;
}

// 旧関数との互換性のため
export function cachedOptimizedSort(
  girls: SortableGirl[],
  preferences: UserPreferences,
  limit: number = 200
): SortableGirl[] {
  return cachedUltraSort(girls, preferences.userLat, preferences.userLon, limit);
}