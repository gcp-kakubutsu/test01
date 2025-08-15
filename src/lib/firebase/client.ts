import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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

let firebaseApp: FirebaseApp | undefined = undefined;
let authInstance: Auth | undefined = undefined;
let dbInstance: Firestore | undefined = undefined;
let storageInstance: FirebaseStorage | undefined = undefined;
let functionsInstance: Functions | undefined = undefined;

// 初期化を遅延実行
function initializeFirebase() {
  if (firebaseApp) return { app: firebaseApp, auth: authInstance, db: dbInstance };
  
  // 既存のアプリがあるか確認
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
  } else {
    // 新規初期化
    try {
      firebaseApp = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      // エラーでも続行（部分的に機能する可能性）
    }
  }
  
  // 各サービスの初期化（エラーを無視）
  if (firebaseApp) {
    try {
      authInstance = getAuth(firebaseApp);
    } catch (e) {
      console.warn('Auth initialization skipped:', e);
    }
    
    try {
      dbInstance = getFirestore(firebaseApp);
    } catch (e) {
      console.warn('Firestore initialization skipped:', e);
    }
    
    try {
      storageInstance = getStorage(firebaseApp);
    } catch (e) {
      console.warn('Storage initialization skipped:', e);
    }
    
    try {
      functionsInstance = getFunctions(firebaseApp);
    } catch (e) {
      console.warn('Functions initialization skipped:', e);
    }
  }
  
  return { app: firebaseApp, auth: authInstance, db: dbInstance, storage: storageInstance, functions: functionsInstance };
}

// 遅延初期化のゲッター
const getFirebaseApp = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp;
};

const getFirebaseAuth = () => {
  if (!authInstance) {
    initializeFirebase();
  }
  return authInstance;
};

const getFirebaseDb = () => {
  if (!dbInstance) {
    initializeFirebase();
  }
  return dbInstance;
};

const getFirebaseStorage = () => {
  if (!storageInstance) {
    initializeFirebase();
  }
  return storageInstance;
};

const getFirebaseFunctions = () => {
  if (!functionsInstance) {
    initializeFirebase();
  }
  return functionsInstance;
};

// エクスポート（遅延初期化）
export const app = getFirebaseApp();
export const auth = getFirebaseAuth();
export const db = getFirebaseDb();
export const storage = getFirebaseStorage();
export const functions = getFirebaseFunctions();

// 動的インポート用の関数もエクスポート
export { getFirebaseAuth, getFirebaseDb, getFirebaseStorage, getFirebaseFunctions };