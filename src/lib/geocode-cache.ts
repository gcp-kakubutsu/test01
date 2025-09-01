import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const COLLECTION_NAME = 'geocode_cache';
const CACHE_TTL_DAYS = 30; // 30日間キャッシュ

// Firestore接続をキャッシュ
let dbInstance: Firestore | null = null;

// バッチ更新用のキュー
const updateQueue = new Map<string, { hitCount: number; lastAccessedAt: Timestamp }>();
let updateTimer: NodeJS.Timeout | null = null;

interface GeocodeCache {
  type: 'forward' | 'reverse';
  key: string;
  data: {
    address?: string;
    coordinates?: { lat: number; lng: number };
    raw?: any;
  };
  createdAt: Timestamp;
  expiresAt: Timestamp;
  hitCount: number;
  lastAccessedAt: Timestamp;
}

// ハッシュキャッシュ
const hashCache = new Map<string, string>();

/**
 * キャッシュキーをハッシュ化してドキュメントIDを生成
 */
function hashCacheKey(key: string): string {
  // メモリにキャッシュ済みならそれを返す
  const cached = hashCache.get(key);
  if (cached) return cached;
  
  const hash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 20);
  hashCache.set(key, hash);
  
  // キャッシュサイズ制限（1000件まで）
  if (hashCache.size > 1000) {
    const firstKey = hashCache.keys().next().value;
    if (firstKey) {
      hashCache.delete(firstKey);
    }
  }
  
  return hash;
}

/**
 * Firestore接続を取得（キャッシュ済み）
 */
function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getAdminFirestore();
  }
  return dbInstance;
}

/**
 * バッチ更新を実行
 */
async function flushUpdateQueue(): Promise<void> {
  if (updateQueue.size === 0) return;
  
  const db = getDb();
  const batch = db.batch();
  
  for (const [docId, updates] of updateQueue.entries()) {
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    batch.update(docRef, updates);
  }
  
  updateQueue.clear();
  
  try {
    await batch.commit();
  } catch (error) {
    console.error('Failed to flush update queue:', error);
  }
}

/**
 * 更新をキューに追加
 */
function queueUpdate(docId: string, hitCount: number, lastAccessedAt: Timestamp): void {
  updateQueue.set(docId, { hitCount, lastAccessedAt });
  
  // タイマーが設定されていない場合は設定
  if (!updateTimer) {
    updateTimer = setTimeout(async () => {
      await flushUpdateQueue();
      updateTimer = null;
    }, 1000); // 1秒後にバッチ更新
  }
}

/**
 * Firestoreからキャッシュを取得
 */
export async function getGeocodeCache(cacheKey: string): Promise<GeocodeCache['data'] | null> {
  try {
    const db = getDb();
    const docId = hashCacheKey(cacheKey);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as GeocodeCache;
    const now = Timestamp.now();

    // 有効期限チェック
    if (data.expiresAt < now) {
      // 期限切れのキャッシュは削除
      await docRef.delete();
      return null;
    }

    // ヒット数とアクセス時刻をキューに追加（バッチ更新）
    queueUpdate(docId, data.hitCount + 1, now);

    return data.data;
  } catch (error) {
    console.error('Error getting geocode cache:', error);
    return null;
  }
}

/**
 * Firestoreにキャッシュを保存
 */
export async function setGeocodeCache(
  cacheKey: string,
  data: GeocodeCache['data'],
  type: 'forward' | 'reverse'
): Promise<void> {
  try {
    const db = getDb();
    const docId = hashCacheKey(cacheKey);
    const now = Timestamp.now();
    
    const cacheDoc: GeocodeCache = {
      type,
      key: cacheKey,
      data,
      createdAt: now,
      expiresAt: Timestamp.fromDate(
        new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
      ),
      hitCount: 0,
      lastAccessedAt: now,
    };

    await db.collection(COLLECTION_NAME).doc(docId).set(cacheDoc);
  } catch (error) {
    console.error('Error setting geocode cache:', error);
    // キャッシュの保存に失敗してもエラーにしない
  }
}

/**
 * 期限切れキャッシュのクリーンアップ（定期実行用）
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const db = getDb();
    const now = Timestamp.now();
    
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where('expiresAt', '<', now)
      .limit(100) // 一度に削除する最大数
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  } catch (error) {
    console.error('Error cleaning up expired cache:', error);
    return 0;
  }
}

/**
 * キャッシュ統計を取得
 */
export async function getCacheStats(): Promise<{
  totalCount: number;
  averageHitCount: number;
  mostFrequent: Array<{ key: string; hitCount: number }>;
}> {
  try {
    const db = getDb();
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    if (snapshot.empty) {
      return {
        totalCount: 0,
        averageHitCount: 0,
        mostFrequent: [],
      };
    }

    const caches = snapshot.docs.map(doc => doc.data() as GeocodeCache);
    const totalHits = caches.reduce((sum, cache) => sum + cache.hitCount, 0);
    const mostFrequent = caches
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map(cache => ({ key: cache.key, hitCount: cache.hitCount }));

    return {
      totalCount: snapshot.size,
      averageHitCount: Math.round(totalHits / snapshot.size),
      mostFrequent,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalCount: 0,
      averageHitCount: 0,
      mostFrequent: [],
    };
  }
}