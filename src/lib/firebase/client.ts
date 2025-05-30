
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
let configIssues = false;

console.log('Firebase Client Config Loading...');
console.log('Attempting to use Firebase config:', {
  apiKey: firebaseConfig.apiKey ? '********' : 'MISSING_OR_EMPTY', // APIキーはマスク
  authDomain: firebaseConfig.authDomain || 'MISSING_OR_EMPTY',
  projectId: firebaseConfig.projectId || 'MISSING_OR_EMPTY',
  storageBucket: firebaseConfig.storageBucket || 'NOT_SET (Optional)',
  messagingSenderId: firebaseConfig.messagingSenderId || 'NOT_SET (Optional)',
  appId: firebaseConfig.appId || 'NOT_SET (Optional)',
  measurementId: firebaseConfig.measurementId || 'NOT_SET (Optional)',
});


// 必須設定項目のチェック
if (!firebaseConfig.apiKey) {
  console.error(
    'Firebase 設定エラー: NEXT_PUBLIC_FIREBASE_API_KEY が未定義または空です。.env ファイルを確認してください。'
  );
  configIssues = true;
}
if (!firebaseConfig.authDomain) {
  console.error(
    'Firebase 設定エラー: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN が未定義または空です。.env ファイルを確認してください。'
  );
  configIssues = true;
}
if (!firebaseConfig.projectId) {
  console.error(
    'Firebase 設定エラー: NEXT_PUBLIC_FIREBASE_PROJECT_ID が未定義または空です。.env ファイルを確認してください。'
  );
  configIssues = true;
}
// appIdも多くのケースで重要なのでチェックを追加
if (!firebaseConfig.appId) {
  console.error(
    'Firebase 設定エラー: NEXT_PUBLIC_FIREBASE_APP_ID が未定義または空です。.env ファイルを確認してください。'
  );
  configIssues = true;
}


if (!configIssues) {
  if (!getApps().length) {
    try {
      console.log("Firebase アプリケーションの初期化を試みます。");
      app = initializeApp(firebaseConfig);
      console.log("Firebase アプリケーションが正常に初期化されました。", app.name);

      if (app) {
        authInstance = getAuth(app);
        console.log("Firebase Auth が正常に初期化されました。");
        dbInstance = getFirestore(app);
        console.log("Firestore が正常に初期化されました。");
      } else {
        // 通常、initializeAppが失敗するとエラーがスローされるため、この分岐には到達しにくい
        console.error("Firebase initializeApp は成功しましたが、app インスタンスが falsy です。");
        firebaseInitError = "initializeApp returned falsy value";
        configIssues = true; // 追加の問題としてマーク
      }
    } catch (error: any) {
      console.error('重大なエラー: Firebase アプリケーションの初期化に失敗しました:', error.message, error.code);
      firebaseInitError = error.message + (error.code ? ` (${error.code})` : '');
      configIssues = true;
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
        configIssues = true;
      }
      try {
        dbInstance = getFirestore(app);
      } catch (e: any) {
        console.error("既存の Firebase App で Firestore の取得に失敗しました:", e.message, e.code);
        if (!firebaseInitError) firebaseInitError = `Failed to get Firestore: ${e.message}`;
        configIssues = true;
      }
    }
  }
}

if (configIssues) {
  console.warn(
    `Firebase の初期化に問題がありました。${firebaseInitError ? `エラー: ${firebaseInitError}` : ''} .env ファイルとFirebaseコンソールの設定を確認してください。Firebase関連機能は動作しない可能性があります。`
  );
  // configIssuesがtrueの場合、app, authInstance, dbInstanceは未定義のままか、エラー発生後に未定義に設定される
  app = undefined;
  authInstance = undefined;
  dbInstance = undefined;
}


const finalApp = app;
const finalAuth = authInstance;
const finalDb = dbInstance;

export { finalApp as app, finalAuth as auth, finalDb as db };
