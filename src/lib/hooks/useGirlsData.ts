import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationCoordinates } from '@/lib/utils/location';

interface GirlData {
  id: string;
  name: string;
  age?: number;
  location?: string;
  [key: string]: any;
}

interface UseGirlsDataOptions {
  limit?: number;
  userLocation?: LocationCoordinates | null;
  enabled?: boolean;
}

// グローバルキャッシュ（5分間保持）
const globalCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5分

// 実行中のリクエストを管理
const pendingRequests = new Map<string, Promise<any>>();

export function useGirlsData(options: UseGirlsDataOptions = {}) {
  const { 
    limit = 200, // 200件はソートに必要な最小限の件数
    userLocation,
    enabled = true 
  } = options;
  
  const [data, setData] = useState<GirlData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedRef = useRef(false);
  
  // キャッシュキーの生成
  const getCacheKey = useCallback(() => {
    const locationKey = userLocation 
      ? `${userLocation.lat.toFixed(3)}_${userLocation.lng.toFixed(3)}`
      : 'no_location';
    return `girls_${limit}_${locationKey}`;
  }, [limit, userLocation]);
  
  // データフェッチ関数
  const fetchGirls = useCallback(async (offset: number = 0) => {
    const cacheKey = getCacheKey();
    
    // キャッシュチェック（初回のみ）
    if (offset === 0) {
      const cached = globalCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('📦 Using cached data:', cacheKey);
        setData(cached.data.girls || []);
        setHasMore(cached.data.hasMore || false);
        return cached.data;
      }
    }
    
    // 既に実行中のリクエストがあれば待機
    const requestKey = `${cacheKey}_${offset}`;
    if (pendingRequests.has(requestKey)) {
      console.log('⏳ Waiting for pending request:', requestKey);
      return pendingRequests.get(requestKey);
    }
    
    // 新しいAbortControllerを作成
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    // APIコール
    const apiUrl = `/api/mysql-girls-fast?limit=${limit}&offset=${offset}${
      userLocation ? `&userLat=${userLocation.lat}&userLng=${userLocation.lng}` : ''
    }`;
    
    console.log('🚀 Fetching girls:', apiUrl);
    
    const fetchPromise = fetch(apiUrl, {
      signal: abortControllerRef.current.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      // 初回データをキャッシュ
      if (offset === 0) {
        globalCache.set(cacheKey, {
          data: { girls: result.girls, hasMore: result.total > limit },
          timestamp: Date.now()
        });
      }
      
      return result;
    })
    .finally(() => {
      pendingRequests.delete(requestKey);
    });
    
    // リクエストを記録
    pendingRequests.set(requestKey, fetchPromise);
    
    return fetchPromise;
  }, [getCacheKey, limit, userLocation]);
  
  // 初回フェッチ
  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        fetchedRef.current = true;
        const result = await fetchGirls(0);
        
        if (result) {
          setData(result.girls || []);
          setHasMore((result.total || 0) > limit);
          console.log(`✅ Loaded ${result.girls?.length || 0} girls`);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('❌ Failed to fetch girls:', err);
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [enabled, fetchGirls, limit]);
  
  // 追加データ読み込み
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const result = await fetchGirls(data.length);
      
      if (result) {
        setData(prev => [...prev, ...(result.girls || [])]);
        setHasMore((result.total || 0) > data.length + limit);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('❌ Failed to load more:', err);
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [data.length, fetchGirls, hasMore, limit, loading]);
  
  // リフレッシュ関数
  const refresh = useCallback(async () => {
    // キャッシュをクリア
    const cacheKey = getCacheKey();
    globalCache.delete(cacheKey);
    
    // リセット
    fetchedRef.current = false;
    setData([]);
    setError(null);
    
    // 再フェッチ
    setLoading(true);
    try {
      const result = await fetchGirls(0);
      
      if (result) {
        setData(result.girls || []);
        setHasMore((result.total || 0) > limit);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('❌ Refresh failed:', err);
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchGirls, getCacheKey, limit]);
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}