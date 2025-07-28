import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

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
      let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log('Initial credentials path:', credentialsPath);
      
      // If it's a relative path, resolve it from the project root
      if (!path.isAbsolute(credentialsPath)) {
        credentialsPath = path.resolve(process.cwd(), credentialsPath);
        console.log('Resolved to absolute path:', credentialsPath);
      }
      
      // Check if file exists
      if (!fs.existsSync(credentialsPath)) {
        console.error('Service account file not found at:', credentialsPath);
        console.error('Current working directory:', process.cwd());
        console.error('Files in project root:', fs.readdirSync(process.cwd()).filter(f => f.endsWith('.json')));
        // Try alternative path
        const altPath = path.join(process.cwd(), 'nukune-e72e97115cbd.json');
        if (fs.existsSync(altPath)) {
          console.log('Found service account file at alternative path:', altPath);
          process.env.GOOGLE_APPLICATION_CREDENTIALS = altPath;
        } else {
          return undefined;
        }
      }
      
      console.log('Service account file found, initializing Firebase Admin SDK');
      try {
        adminApp = initializeApp(undefined, 'admin');
        console.log('Firebase Admin SDK initialized successfully (development mode)');
        return adminApp;
      } catch (initError) {
        console.error('Failed to initialize with service account file:', initError);
        return undefined;
      }
    }
    
    // Fallback: 環境変数から認証情報を読み込む
    console.log('Service account file not available, trying environment variables');
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
        
        console.log('Firebase Admin SDK initialized successfully (environment variables mode)');
        return adminApp;
      } catch (certError) {
        console.error('Error with certificate:', certError);
        console.error('Certificate details:');
        console.error('- Project ID:', process.env.FIREBASE_ADMIN_PROJECT_ID);
        console.error('- Client Email:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
        console.error('- Private Key format valid:', process.env.FIREBASE_ADMIN_PRIVATE_KEY?.includes('BEGIN PRIVATE KEY'));
        return undefined;
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
console.log('=== Firebase Admin SDK Initialization ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Not set');
console.log('FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID ? 'Set' : 'Not set');
console.log('FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'Set' : 'Not set');
console.log('FIREBASE_ADMIN_PRIVATE_KEY:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? 'Set (length: ' + process.env.FIREBASE_ADMIN_PRIVATE_KEY.length + ')' : 'Not set');
const app = initializeAdmin();
console.log('Admin SDK initialized:', !!app);
console.log('=========================================');

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