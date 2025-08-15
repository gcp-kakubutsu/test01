import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  type Auth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence
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
    console.log('🔥 Firebase initialization starting...');
    
    // 設定値の検証
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required Firebase config: ${missingFields.join(', ')}`);
    }

    // Firebaseアプリの初期化
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log('✅ Using existing Firebase app');
      app = existingApps[0];
    } else {
      console.log('🚀 Initializing new Firebase app');
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase app initialized');
    }

    // Auth初期化（CORS対応）
    if (app) {
      try {
        auth = getAuth(app);
        
        // ブラウザ環境での設定
        if (typeof window !== 'undefined') {
          // デフォルトの永続化設定（全ブラウザ対応）
          setPersistence(auth, browserLocalPersistence).then(() => {
            console.log('✅ Auth persistence set to LOCAL');
          }).catch((error) => {
            console.warn('⚠️ Could not set persistence, using default:', error.message);
          });
        }
        
        console.log('✅ Auth initialized');
      } catch (error: any) {
        console.error('❌ Auth initialization failed:', error);
        auth = undefined;
      }
    }

    // Firestore初期化
    if (app) {
      try {
        db = getFirestore(app);
        console.log('✅ Firestore initialized');
      } catch (error: any) {
        console.error('❌ Firestore initialization failed:', error);
        db = undefined;
      }
    }

    // Storage初期化
    if (app) {
      try {
        storage = getStorage(app);
        console.log('✅ Storage initialized');
      } catch (error: any) {
        console.error('❌ Storage initialization failed:', error);
        storage = undefined;
      }
    }

    // Functions初期化
    if (app) {
      try {
        functions = getFunctions(app);
        console.log('✅ Functions initialized');
      } catch (error: any) {
        console.error('❌ Functions initialization failed:', error);
        functions = undefined;
      }
    }

    initialized = true;
    console.log('🎉 Firebase initialization completed');
    
  } catch (error: any) {
    console.error('💥 Firebase initialization failed:', error);
    initializationError = error;
    initialized = true; // エラーでも初期化済みとマーク
  }
}

// ブラウザ環境で自動初期化
if (typeof window !== 'undefined') {
  // DOMContentLoadedを待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebaseServices);
  } else {
    // 既にDOMが読み込まれている場合
    initializeFirebaseServices();
  }
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