
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// .envファイルから設定を読み込む
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp | undefined = undefined;
let authInstance: Auth | undefined = undefined;
let dbInstance: Firestore | undefined = undefined;
let firebaseInitError: string | null = null;

console.log('Firebase Client Config Loading Attempt...');

const placeholderKeywords = [
  "YOUR_API_KEY_HERE",
  "YOUR_AUTH_DOMAIN_HERE",
  "YOUR_PROJECT_ID_HERE",
  "YOUR_STORAGE_BUCKET_HERE",
  "YOUR_MESSAGING_SENDER_ID_HERE",
  "YOUR_APP_ID_HERE",
  "YOUR_MEASUREMENT_ID_HERE"
];

let usesPlaceholders = false;
if (firebaseConfig.apiKey && placeholderKeywords.some(p => firebaseConfig.apiKey?.includes(p))) usesPlaceholders = true;
if (firebaseConfig.authDomain && placeholderKeywords.some(p => firebaseConfig.authDomain?.includes(p))) usesPlaceholders = true;
if (firebaseConfig.projectId && placeholderKeywords.some(p => firebaseConfig.projectId?.includes(p))) usesPlaceholders = true;
if (firebaseConfig.appId && placeholderKeywords.some(p => firebaseConfig.appId?.includes(p))) usesPlaceholders = true;


// apiKey, authDomain, projectId, appId はFirebaseの基本的な機能に必須です。
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.appId ||
  usesPlaceholders
) {
  const reason = usesPlaceholders 
    ? "必須のFirebase設定値がプレースホルダーのままです。"
    : "必須のFirebase設定値 (apiKey, authDomain, projectId, appId) のいずれかが.envファイルに未定義または空です。";
  
  console.error(
    `Firebase 設定エラー: ${reason} ファイルを確認し、Next.js開発サーバーを再起動してください。`
  );
  console.error('現在の読み込み値:', {
    apiKey: firebaseConfig.apiKey ? (placeholderKeywords.some(p => firebaseConfig.apiKey?.includes(p)) ? 'PLACEHOLDER_DETECTED' : '********') : 'MISSING_OR_EMPTY',
    authDomain: firebaseConfig.authDomain ? (placeholderKeywords.some(p => firebaseConfig.authDomain?.includes(p)) ? 'PLACEHOLDER_DETECTED' : firebaseConfig.authDomain) : 'MISSING_OR_EMPTY',
    projectId: firebaseConfig.projectId ? (placeholderKeywords.some(p => firebaseConfig.projectId?.includes(p)) ? 'PLACEHOLDER_DETECTED' : firebaseConfig.projectId) : 'MISSING_OR_EMPTY',
    appId: firebaseConfig.appId ? (placeholderKeywords.some(p => firebaseConfig.appId?.includes(p)) ? 'PLACEHOLDER_DETECTED' : firebaseConfig.appId) : 'MISSING_OR_EMPTY',
    storageBucket: firebaseConfig.storageBucket || 'NOT_SET (Optional)',
    messagingSenderId: firebaseConfig.messagingSenderId || 'NOT_SET (Optional)',
    measurementId: firebaseConfig.measurementId || 'NOT_SET (Optional)',
  });
  firebaseInitError = reason;
} else {
  if (!getApps().length) {
    try {
      console.log("Firebase アプリケーションの初期化を試みます。");
      app = initializeApp(firebaseConfig);
      console.log("Firebase アプリケーションが正常に初期化されました。");
      authInstance = getAuth(app);
      console.log("Firebase Auth が正常に初期化されました。");
      dbInstance = getFirestore(app);
      console.log("Firestore が正常に初期化されました。");
    } catch (error: any) {
      console.error('重大なエラー: Firebase アプリケーションの初期化に失敗しました:', error.message, error.code);
      firebaseInitError = `Firebase app could not be initialized. Original error: ${error.message}${error.code ? ` (${error.code})` : ''}. Check console for details and verify your .env file.`;
      app = undefined;
      authInstance = undefined;
      dbInstance = undefined;
    }
  } else {
    console.log("Firebase アプリケーションは既に初期化されています。既存のインスタンスを使用します。");
    app = getApps()[0];
    if (app) {
      try {
        authInstance = getAuth(app);
      } catch (e: any) {
        console.error("既存の Firebase App で Auth の取得に失敗しました:", e.message, e.code);
        firebaseInitError = `Failed to get Auth: ${e.message}`;
      }
      try {
        dbInstance = getFirestore(app);
      } catch (e: any) {
        console.error("既存の Firebase App で Firestore の取得に失敗しました:", e.message, e.code);
        if (!firebaseInitError) firebaseInitError = `Failed to get Firestore: ${e.message}`;
      }
    }
  }
}

if (firebaseInitError && typeof window !== 'undefined') {
  console.error("Firebase Initialization Error (client-side log):", firebaseInitError);
}

const finalApp = app;
const finalAuth = authInstance;
const finalDb = dbInstance;

export { finalApp as app, finalAuth as auth, finalDb as db, firebaseInitError };
