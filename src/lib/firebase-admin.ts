import { initializeApp, cert, getApps, type ServiceAccount, type App, applicationDefault } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

/**
 * Firebase Admin SDKを初期化
 */
export function initializeAdmin(): App {
  // 既に初期化済みの場合は既存のアプリを返す
  if (app) {
    return app;
  }

  // 既存のアプリがある場合はそれを使用
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  // 開発環境：GOOGLE_APPLICATION_CREDENTIALSを優先
  if (process.env.NODE_ENV === 'development') {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (credentialsPath) {
      try {
        // Application Default Credentialsを使用
        app = initializeApp({
          credential: applicationDefault(),
          projectId,
        });
        console.log('✅ Firebase Admin initialized with application default credentials');
        return app;
      } catch (error) {
        console.error('Failed to initialize with application default credentials:', error);
      }
    }

    // フォールバック：環境変数から直接認証情報を取得
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      try {
        // 秘密鍵のフォーマットを修正
        // エスケープされた改行文字を実際の改行に変換
        const formattedPrivateKey = privateKey
          .replace(/\\n/g, '\n')
          .replace(/^["']|["']$/g, ''); // 引用符を削除

        const serviceAccount: ServiceAccount = {
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        };

        app = initializeApp({
          credential: cert(serviceAccount),
          projectId,
        });
        
        console.log('✅ Firebase Admin initialized with service account from env');
        return app;
      } catch (error) {
        console.error('Failed to initialize with service account from env:', error);
      }
    }
  }

  // 本番環境：デフォルト認証（App Hosting等）
  try {
    app = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
    
    console.log('✅ Firebase Admin initialized with default credentials');
    return app;
  } catch (error) {
    // 最後の手段：認証なしで初期化（一部の機能のみ利用可能）
    console.warn('Initializing Firebase Admin without credentials - some features may not work');
    app = initializeApp({
      projectId,
    });
    return app;
  }
}

/**
 * Firebase Admin Authを取得
 */
export function getAdminAuth(): Auth {
  if (!auth) {
    const adminApp = initializeAdmin();
    auth = getAuth(adminApp);
  }
  return auth;
}

/**
 * Firebase Admin Firestoreを取得
 */
export function getAdminFirestore(): Firestore {
  if (!db) {
    const adminApp = initializeAdmin();
    db = getFirestore(adminApp);
  }
  return db;
}