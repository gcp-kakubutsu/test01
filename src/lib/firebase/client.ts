import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  type Auth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  type Firestore, 
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import { isLineBrowser, isIndexedDBAvailable, getBrowserInfo } from '@/lib/utils/browser-detection';
import { listenerManager } from '@/lib/firebase/listener-manager';

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// シングルトンインスタンス
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

// 初期化状態
let initialized = false;
let initializationError: Error | null = null;
let isResettingDb = false; // Firestore再初期化の同時実行を防ぐフラグ

/**
 * Firebaseを初期化する関数
 */
function initializeFirebaseServices(): void {
  if (initialized) return;
  
  try {
    // 設定値の検証
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required Firebase config: ${missingFields.join(', ')}`);
    }

    // Firebaseアプリの初期化
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }

    // Auth初期化
    if (app) {
      try {
        auth = getAuth(app);
        
        // セッションから認証状態を復元
        if (typeof window !== 'undefined') {
          restoreAuthFromSession();
        }
      } catch (error: any) {
        auth = undefined;
      }
    }

    // Firestore初期化（LINEブラウザ対応）
    if (app) {
      try {
        // 既存のFirestoreインスタンスがあるかチェック
        try {
          db = getFirestore(app);
          console.log('✅ Using existing Firestore instance');
        } catch (noExistingInstance) {
          // 新規初期化が必要
          const browserInfo = getBrowserInfo();
          console.log('🌐 Browser info:', browserInfo);
          
          // LINEブラウザまたはIndexedDBが使えない環境の場合
          if (browserInfo.isLine || !browserInfo.hasIndexedDB) {
            console.log('📱 LINE browser detected - using memory cache for Firestore');
            
            // メモリキャッシュを使用（IndexedDBを使わない）
            db = initializeFirestore(app, {
              localCache: memoryLocalCache(),
              experimentalForceLongPolling: true, // WebSocket接続の代わりにlong pollingを使用
            });
          } else {
            // 通常のブラウザの場合
            try {
              // シングルタブモードで初期化（マルチタブ同期の問題を回避）
              db = initializeFirestore(app, {
                localCache: persistentLocalCache()
              });
            } catch (persistError: any) {
              console.warn('⚠️ Failed to initialize with persistent cache, falling back to memory cache:', persistError);
              // フォールバック: メモリキャッシュを使用
              db = initializeFirestore(app, {
                localCache: memoryLocalCache()
              });
            }
          }
        }
      } catch (error: any) {
        console.error('❌ Firestore initialization failed:', error);
        db = undefined;
      }
    }

    // Storage初期化
    if (app) {
      try {
        storage = getStorage(app);
      } catch (error: any) {
        storage = undefined;
      }
    }

    // Functions初期化
    if (app) {
      try {
        functions = getFunctions(app);
      } catch (error: any) {
        functions = undefined;
      }
    }

    initialized = true;
    
  } catch (error: any) {
    // Silently handle initialization errors
    initializationError = error;
    initialized = true; // エラーでも初期化済みとマーク
  }
}

// セッション復元の実行フラグ
let isRestoringSession = false;

/**
 * セッションから認証状態を復元（非同期でブロックしない）
 */
function restoreAuthFromSession() {
  // 既に実行中の場合はスキップ（429エラー対策）
  if (isRestoringSession) {
    return;
  }
  isRestoringSession = true;
  
  // 非同期で実行し、ブロッキングを避ける
  setTimeout(async () => {
    try {
      // ngrok環境対応のヘッダー
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      // ngrok環境の場合、警告ページをスキップ
      if (typeof window !== 'undefined' && 
          (window.location.hostname.includes('ngrok') || 
           window.location.hostname.includes('ngrok-free'))) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
      
      // セッション確認APIを呼び出し
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.customToken) {
          // IDトークンを使用して認証
          const { signInWithIdToken } = await import('./auth-helper');
          await signInWithIdToken(data.customToken);
        }
      }
    } catch (error) {
      // Silently handle auth restoration errors
    } finally {
      isRestoringSession = false;
    }
  }, 500); // 遅延を増やして429エラーを防ぐ
}

// ブラウザ環境で自動初期化（即座に実行）
if (typeof window !== 'undefined') {
  // 即座に初期化を実行（DOMを待たない）
  initializeFirebaseServices();
  
  // ページアンロード時にリスナーをクリーンアップ
  window.addEventListener('beforeunload', () => {
    listenerManager.unregisterAll();
  });
}

/**
 * Firebase Authを取得
 */
export function getFirebaseAuth(): Auth | undefined {
  if (!initialized && typeof window !== 'undefined') {
    initializeFirebaseServices();
  }
  return auth;
}

/**
 * Firebase Firestoreを取得
 */
export function getFirebaseDb(): Firestore | undefined {
  if (!initialized && typeof window !== 'undefined') {
    initializeFirebaseServices();
  }
  
  // リセット中は undefined を返して呼び出し側にリトライさせる
  if (isResettingDb) {
    return undefined;
  }

  // Firestoreが終了している場合は再初期化を試みる
  if (db && typeof window !== 'undefined') {
    try {
      // Firestoreが使用可能かチェック
      const { _terminated } = db as any;
      if (_terminated) {
        console.warn('⚠️ Firestore was terminated, reinitializing...');
        db = undefined;
        if (app) {
          try {
            const browserInfo = getBrowserInfo();
            if (browserInfo.isLine || !browserInfo.hasIndexedDB) {
              db = initializeFirestore(app, {
                localCache: memoryLocalCache(),
                experimentalForceLongPolling: true,
              });
            } else {
              try {
                db = initializeFirestore(app, {
                  localCache: persistentLocalCache()
                });
              } catch (persistError: any) {
                db = initializeFirestore(app, {
                  localCache: memoryLocalCache()
                });
              }
            }
            console.log('✅ Firestore reinitialized successfully');
          } catch (error) {
            console.error('❌ Failed to reinitialize Firestore:', error);
          }
        }
      }
    } catch (error) {
      // Silently handle check errors
    }
  }
  
  return db;
}

/**
 * Firebase Storageを取得
 */
export function getFirebaseStorage(): FirebaseStorage | undefined {
  if (!initialized && typeof window !== 'undefined') {
    initializeFirebaseServices();
  }
  return storage;
}

/**
 * Firebase Functionsを取得
 */
export function getFirebaseFunctions(): Functions | undefined {
  if (!initialized && typeof window !== 'undefined') {
    initializeFirebaseServices();
  }
  return functions;
}

/**
 * 初期化エラーを取得
 */
export function getInitializationError(): Error | null {
  return initializationError;
}

/**
 * Firestore接続をリセット（ユーザー切り替え時用）
 */
export async function resetFirestoreConnection(): Promise<void> {
  console.log('🔄 Resetting Firestore connection...');
  if (isResettingDb) return;
  isResettingDb = true;
  
  // すべてのリスナーをクリーンアップ
  listenerManager.unregisterAll();
  
  // Firestoreインスタンスの参照を破棄（terminateは呼ばない。呼ぶと"shutting down"が発生しやすい）
  db = undefined;
  
  // 再初期化
  if (app) {
    try {
      const browserInfo = getBrowserInfo();
      
      // LINEブラウザまたはIndexedDBが使えない環境の場合
      if (browserInfo.isLine || !browserInfo.hasIndexedDB) {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
          experimentalForceLongPolling: true,
        });
      } else {
        try {
          db = initializeFirestore(app, {
            localCache: persistentLocalCache()
          });
        } catch (persistError: any) {
          db = initializeFirestore(app, {
            localCache: memoryLocalCache()
          });
        }
      }
      console.log('✅ Firestore reinitialized');
    } catch (error) {
      console.error('❌ Failed to reinitialize Firestore:', error);
    }
  }
  isResettingDb = false;
}

// 既存コードとの互換性
export { app, auth, db, storage, functions };