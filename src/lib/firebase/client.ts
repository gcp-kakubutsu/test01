import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  type Auth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

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

    // Firestore初期化
    if (app) {
      try {
        db = getFirestore(app);
      } catch (error: any) {
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

/**
 * セッションから認証状態を復元（非同期でブロックしない）
 */
function restoreAuthFromSession() {
  // 非同期で実行し、ブロッキングを避ける
  setTimeout(async () => {
    try {
      // セッション確認APIを呼び出し
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'include',
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
    }
  }, 100);
}

// ブラウザ環境で自動初期化（即座に実行）
if (typeof window !== 'undefined') {
  // 即座に初期化を実行（DOMを待たない）
  initializeFirebaseServices();
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

// 既存コードとの互換性
export { app, auth, db, storage, functions };