import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let adminApp: App | undefined;

/**
 * Firebase Admin SDKを初期化
 * 本番環境では環境変数から、開発環境ではGoogle Application Credentialsから読み込み
 */
function initializeAdmin(): App | undefined {
  // 既に初期化されている場合は既存のアプリを返す
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) {
    return existingApp;
  }

  try {
    // 開発環境: GOOGLE_APPLICATION_CREDENTIALSを優先
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Initializing Firebase Admin SDK with service account file');
      adminApp = initializeApp(undefined, 'admin');
      console.log('Firebase Admin SDK initialized successfully (development mode)');
      return adminApp;
    }
    
    // 本番環境: 環境変数から認証情報を読み込む
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
        process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      
      console.log('Initializing Firebase Admin SDK with environment variables');
      
      try {
        // プライベートキーの処理を改善
        let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
        
        // もしキーが引用符で囲まれている場合は削除
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }
        
        // JSONエスケープされた改行を実際の改行に変換
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        }, 'admin');
        
        console.log('Firebase Admin SDK initialized successfully (production mode)');
        return adminApp;
      } catch (certError) {
        console.error('Error with certificate:', certError);
        throw certError;
      }
    }
    
    // 環境変数が設定されていない場合
    console.error(
      'Firebase Admin SDK initialization failed: No credentials found. ' +
      'For production, set FIREBASE_ADMIN_* environment variables. ' +
      'For development, set GOOGLE_APPLICATION_CREDENTIALS.'
    );
    return undefined;
    
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
    return undefined;
  }
}

// Admin SDKを初期化
const app = initializeAdmin();

// エクスポート用のヘルパー関数
export function getAdminAuth() {
  if (!app) {
    throw new Error('Firebase Admin SDK is not initialized');
  }
  return getAuth(app);
}

export function getAdminFirestore() {
  if (!app) {
    throw new Error('Firebase Admin SDK is not initialized');
  }
  return getFirestore(app);
}

export function getAdminStorage() {
  if (!app) {
    throw new Error('Firebase Admin SDK is not initialized');
  }
  return getStorage(app);
}

// Admin SDKが初期化されているかチェック
export function isAdminInitialized(): boolean {
  return !!app;
}