import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

// Firebase設定 - 環境変数から取得
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
 * エラーが発生しても部分的に動作可能にする
 */
function initializeFirebaseServices(): void {
  if (initialized) return;
  
  try {
    console.log('Starting Firebase initialization...');
    console.log('Config:', {
      apiKey: firebaseConfig.apiKey ? '***' : 'missing',
      authDomain: firebaseConfig.authDomain || 'missing',
      projectId: firebaseConfig.projectId || 'missing',
      appId: firebaseConfig.appId ? '***' : 'missing',
    });

    // 必須設定の確認
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || 
        !firebaseConfig.projectId || !firebaseConfig.appId) {
      throw new Error('Missing required Firebase configuration');
    }

    // 既存のアプリを確認
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log('Using existing Firebase app');
      app = existingApps[0];
    } else {
      console.log('Creating new Firebase app');
      app = initializeApp(firebaseConfig);
    }

    // Auth初期化
    if (app) {
      try {
        auth = getAuth(app);
        console.log('Auth initialized successfully');
      } catch (error) {
        console.error('Auth initialization error:', error);
      }
    }

    // Firestore初期化
    if (app) {
      try {
        db = getFirestore(app);
        console.log('Firestore initialized successfully');
      } catch (error) {
        console.error('Firestore initialization error:', error);
      }
    }

    // Storage初期化
    if (app) {
      try {
        storage = getStorage(app);
        console.log('Storage initialized successfully');
      } catch (error) {
        console.error('Storage initialization error:', error);
      }
    }

    // Functions初期化
    if (app) {
      try {
        functions = getFunctions(app);
        console.log('Functions initialized successfully');
      } catch (error) {
        console.error('Functions initialization error:', error);
      }
    }

    initialized = true;
    console.log('Firebase initialization completed');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    initializationError = error as Error;
    initialized = true; // エラーでも初期化済みとマーク
  }
}

// 即座に初期化を実行
if (typeof window !== 'undefined') {
  // ブラウザ環境では即座に初期化
  initializeFirebaseServices();
}

/**
 * Firebaseサービスを取得するゲッター関数
 */
export function getFirebaseAuth(): Auth | undefined {
  if (!initialized) {
    initializeFirebaseServices();
  }
  return auth;
}

export function getFirebaseDb(): Firestore | undefined {
  if (!initialized) {
    initializeFirebaseServices();
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | undefined {
  if (!initialized) {
    initializeFirebaseServices();
  }
  return storage;
}

export function getFirebaseFunctions(): Functions | undefined {
  if (!initialized) {
    initializeFirebaseServices();
  }
  return functions;
}

export function getInitializationError(): Error | null {
  return initializationError;
}

// 既存コードとの互換性のためのエクスポート
export { app, auth, db, storage, functions };