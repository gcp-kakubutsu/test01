import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { getGeocodeCache, setGeocodeCache } from '@/lib/geocode-cache';

// LRUキャッシュの設定
const cache = new LRUCache<string, any>({
  max: 500, // 最大500件のキャッシュ
  ttl: 1000 * 60 * 60 * 24, // 24時間のTTL
  updateAgeOnGet: true, // アクセス時に有効期限をリセット
  updateAgeOnHas: true,
});

// キャッシュ統計用
let memoryCacheHits = 0;
let firestoreCacheHits = 0;
let cacheMisses = 0;

// キャッシュキーの生成
function getCacheKey(params: { lat?: number; lng?: number; address?: string }): string {
  if (params.address) {
    return `addr:${params.address}`;
  }
  if (params.lat && params.lng) {
    // 座標を小数点第4位で丸める（約11m精度）
    const roundedLat = Math.round(params.lat * 10000) / 10000;
    const roundedLng = Math.round(params.lng * 10000) / 10000;
    return `coord:${roundedLat},${roundedLng}`;
  }
  return '';
}

// リトライ機能付きのfetch
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000), // 5秒タイムアウト
      });
      
      if (response.ok) {
        return response;
      }
      
      // 429 (Too Many Requests) の場合は少し待つ
      if (response.status === 429 && i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(`API responded with status ${response.status}`);
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        // エクスポネンシャルバックオフ
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { lat, lng, address: inputAddress } = await request.json();
    
    // 住所から座標を取得する場合（フォワードジオコーディング）
    if (inputAddress && !lat && !lng) {
      const cacheKey = getCacheKey({ address: inputAddress });
      
      // 第1層: メモリキャッシュチェック
      const memoryCached = cache.get(cacheKey);
      if (memoryCached) {
        memoryCacheHits++;
        const responseTime = Date.now() - startTime;
        console.log(`[Geocode Memory Cache HIT] Key: ${cacheKey}, Time: ${responseTime}ms`);
        return NextResponse.json({
          ...memoryCached,
          cacheLevel: 'memory',
          responseTime
        });
      }
      
      // 第2層: Firestoreキャッシュチェック
      const firestoreCached = await getGeocodeCache(cacheKey);
      if (firestoreCached) {
        firestoreCacheHits++;
        // メモリキャッシュにも保存
        cache.set(cacheKey, firestoreCached);
        const responseTime = Date.now() - startTime;
        console.log(`[Geocode Firestore Cache HIT] Key: ${cacheKey}, Time: ${responseTime}ms`);
        return NextResponse.json({
          ...firestoreCached,
          cacheLevel: 'firestore',
          responseTime
        });
      }
      
      cacheMisses++;
      
      const response = await fetchWithRetry(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputAddress)}&accept-language=ja&limit=1`,
        {
          headers: {
            'User-Agent': 'Nukune Dating App',
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding API failed');
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const responseData = {
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          address: inputAddress,
          raw: result
        };
        
        // 両方のキャッシュに保存
        cache.set(cacheKey, responseData);
        await setGeocodeCache(cacheKey, responseData, 'forward');
        
        const responseTime = Date.now() - startTime;
        console.log(`[Geocode Cache MISS] Key: ${cacheKey}, Time: ${responseTime}ms, Stats: Memory:${memoryCacheHits}/Firestore:${firestoreCacheHits}/Miss:${cacheMisses}`);
        
        return NextResponse.json({
          ...responseData,
          cacheLevel: 'none',
          responseTime
        });
      } else {
        return NextResponse.json({
          error: '住所から座標を取得できませんでした',
          address: inputAddress
        });
      }
    }
    
    // 座標から住所を取得する場合（リバースジオコーディング）
    if (!lat || !lng) {
      return NextResponse.json(
        { error: '緯度と経度が必要です' },
        { status: 400 }
      );
    }

    // キャッシュキーの生成
    const cacheKey = getCacheKey({ lat, lng });
    
    // 第1層: メモリキャッシュチェック
    const memoryCached = cache.get(cacheKey);
    if (memoryCached) {
      memoryCacheHits++;
      const responseTime = Date.now() - startTime;
      console.log(`[Geocode Memory Cache HIT] Key: ${cacheKey}, Time: ${responseTime}ms`);
      return NextResponse.json({
        ...memoryCached,
        cacheLevel: 'memory',
        responseTime
      });
    }
    
    // 第2層: Firestoreキャッシュチェック
    const firestoreCached = await getGeocodeCache(cacheKey);
    if (firestoreCached) {
      firestoreCacheHits++;
      // メモリキャッシュにも保存
      cache.set(cacheKey, firestoreCached);
      const responseTime = Date.now() - startTime;
      console.log(`[Geocode Firestore Cache HIT] Key: ${cacheKey}, Time: ${responseTime}ms`);
      return NextResponse.json({
        ...firestoreCached,
        cacheLevel: 'firestore',
        responseTime
      });
    }
    
    cacheMisses++;
    
    // 第3層: Nominatim APIを使用してリバースジオコーディング
    const response = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja&zoom=14`,
      {
        headers: {
          'User-Agent': 'Nukune Dating App',
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding API failed');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // 住所の詳細度を調整
    let address = '';
    
    if (data.address) {
      const addressParts = [];
      
      // 日本の住所形式で優先度の高い順に取得
      // 1. 都道府県レベル
      const prefecture = data.address.state || data.address.prefecture || data.address.province;
      if (prefecture) {
        addressParts.push(prefecture);
      }
      
      // 2. 市区町村レベル
      const city = data.address.city || data.address.town || data.address.village;
      if (city) {
        addressParts.push(city);
      }
      
      // 3. 区・地区レベル（市区町村と重複しない場合のみ）
      const district = data.address.suburb || data.address.neighbourhood || data.address.quarter;
      if (district && district !== city) {
        addressParts.push(district);
      }
      
      // 4. 郡レベル（都道府県と市区町村の間に入る場合）
      if (!city && data.address.county) {
        addressParts.push(data.address.county);
      }
      
      if (addressParts.length > 0) {
        // 最大3つの要素を結合（例：「大阪府大阪市中央区」）
        address = addressParts.slice(0, 3).join('');
      }
    }

    // 表示名から抽出するフォールバック
    if (!address && data.display_name) {
      // 表示名をカンマで分割
      const parts = data.display_name.split(',').map((s: string) => s.trim());
      
      // 日本の住所を抽出（数字と国名を除外）
      const filteredParts = parts.filter((part: string) => 
        !part.match(/^\d/) && 
        part !== '日本' && 
        part !== 'Japan' &&
        part !== ''
      );
      
      // 最初の3つの要素を結合（通常は都道府県、市区町村、地区）
      if (filteredParts.length > 0) {
        address = filteredParts.slice(0, 3).join('');
      }
    }

    const responseData = {
      address: address || '詳細な住所を取得できませんでした',
      raw: data // デバッグ用に生データも返す
    };
    
    // 両方のキャッシュに保存
    cache.set(cacheKey, responseData);
    await setGeocodeCache(cacheKey, responseData, 'reverse');
    
    const responseTime = Date.now() - startTime;
    console.log(`[Geocode Cache MISS] Key: ${cacheKey}, Time: ${responseTime}ms, Stats: Memory:${memoryCacheHits}/Firestore:${firestoreCacheHits}/Miss:${cacheMisses}`);
    
    return NextResponse.json({
      ...responseData,
      cacheLevel: 'none',
      responseTime
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'ジオコーディングに失敗しました' },
      { status: 500 }
    );
  }
}