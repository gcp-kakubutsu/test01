/**
 * APIリクエストの重複を防ぎ、キャッシュを管理するユーティリティ
 */

// 実行中のリクエストを管理
const pendingRequests = new Map<string, Promise<any>>();

// メモリキャッシュ（5分間保持）
const cache = new Map<string, { data: any; timestamp: number; etag?: string }>();
const CACHE_TTL = 300000; // 5分

// 位置情報を丸める（精度を下げてキャッシュヒット率を上げる）
export function roundLocation(lat: number, lng: number, precision: number = 3): { lat: number; lng: number } {
  const factor = Math.pow(10, precision);
  return {
    lat: Math.round(lat * factor) / factor,
    lng: Math.round(lng * factor) / factor
  };
}

// キャッシュキーの生成
export function generateCacheKey(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const keyParts = sortedKeys.map(key => {
    const value = params[key];
    if (typeof value === 'number' && key.includes('Lat') || key.includes('Lng')) {
      // 位置情報は小数点3桁まで
      return `${key}:${value.toFixed(3)}`;
    }
    return `${key}:${value}`;
  });
  return keyParts.join('_');
}

// デバウンス処理
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// 重複リクエストを防ぐフェッチ関数
export async function fetchWithDedup(
  url: string,
  options: RequestInit = {},
  cacheKey?: string
): Promise<any> {
  const key = cacheKey || url;
  
  // キャッシュチェック
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 Cache hit:', key);
    return cached.data;
  }
  
  // 実行中のリクエストがあれば待機
  if (pendingRequests.has(key)) {
    console.log('⏳ Waiting for pending request:', key);
    return pendingRequests.get(key);
  }
  
  // 新しいリクエストを作成
  const fetchPromise = fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    }
  })
  .then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // キャッシュに保存
    cache.set(key, {
      data,
      timestamp: Date.now(),
      etag: response.headers.get('etag') || undefined
    });
    
    return data;
  })
  .finally(() => {
    // リクエスト完了後にクリア
    pendingRequests.delete(key);
  });
  
  // リクエストを記録
  pendingRequests.set(key, fetchPromise);
  
  return fetchPromise;
}

// キャッシュをクリア
export function clearCache(pattern?: string): void {
  if (pattern) {
    // パターンに一致するキャッシュのみクリア
    for (const [key] of cache) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    // 全キャッシュをクリア
    cache.clear();
  }
  
  // ペンディングリクエストもクリア
  pendingRequests.clear();
}

// キャッシュ統計を取得
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  
  for (const [, value] of cache) {
    if (oldest === null || value.timestamp < oldest) {
      oldest = value.timestamp;
    }
  }
  
  return {
    size: cache.size,
    oldestEntry: oldest
  };
}