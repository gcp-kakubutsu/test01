
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, setPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, type Firestore, enableNetwork, disableNetwork, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

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
let storageInstance: FirebaseStorage | undefined = undefined;
let functionsInstance: Functions | undefined = undefined;
let firebaseInitError: string | null = null;

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
  
  // Silently handle missing config
  firebaseInitError = reason;
} else {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      
      // Simplified persistence setup
      if (typeof window !== 'undefined') {
        // Don't set persistence explicitly - use Firebase default
        // This avoids issues with LINE browser and other restricted environments
        console.log('Using default Firebase persistence');
      }
      
      dbInstance = getFirestore(app);
      storageInstance = getStorage(app);
      functionsInstance = getFunctions(app);
    } catch (error: any) {
      firebaseInitError = `Firebase app could not be initialized. Original error: ${error.message}${error.code ? ` (${error.code})` : ''}. Check console for details and verify your .env file.`;
      app = undefined;
      authInstance = undefined;
      dbInstance = undefined;
      storageInstance = undefined;
      functionsInstance = undefined;
    }
  } else {
    app = getApps()[0];
    if (app) {
      try {
        authInstance = getAuth(app);
      } catch (e: any) {
        firebaseInitError = `Failed to get Auth: ${e.message}`;
      }
      try {
        dbInstance = getFirestore(app);
      } catch (e: any) {
        if (!firebaseInitError) firebaseInitError = `Failed to get Firestore: ${e.message}`;
      }
      try {
        storageInstance = getStorage(app);
      } catch (e: any) {
        if (!firebaseInitError) firebaseInitError = `Failed to get Storage: ${e.message}`;
      }
      try {
        functionsInstance = getFunctions(app);
      } catch (e: any) {
        if (!firebaseInitError) firebaseInitError = `Failed to get Functions: ${e.message}`;
      }
    }
  }
}

// Silently handle initialization errors

const finalApp = app;
const finalAuth = authInstance;
const finalDb = dbInstance;
const finalStorage = storageInstance;
const finalFunctions = functionsInstance;

export { finalApp as app, finalAuth as auth, finalDb as db, finalStorage as storage, finalFunctions as functions, firebaseInitError };
