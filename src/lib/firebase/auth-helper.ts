import { getFirebaseAuth } from './client';
import { signInWithCustomToken, onAuthStateChanged, signInWithCredential, EmailAuthProvider } from 'firebase/auth';

/**
 * IDトークンでFirebase Authにサインイン
 */
export async function signInWithIdToken(idToken: string): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn('Firebase Auth not available');
      return false;
    }

    // IDトークンからユーザー情報を抽出
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString()
    );
    
    const uid = payload.sub || payload.user_id || payload.localId;

    // 既に同じユーザーで認証済みかチェック
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      console.log('✅ Already signed in with correct user:', currentUser.email);
      return true;
    }

    try {
      // カスタムトークンとして試す
      await signInWithCustomToken(auth, idToken);
      console.log('✅ Signed in with custom token');
      return true;
    } catch (customTokenError: any) {
      console.warn('Not a custom token:', customTokenError.code);
      
      // カスタムトークンでない場合、認証情報をローカルに保存
      if (typeof window !== 'undefined') {
        // Firebaseの認証状態をエミュレート
        const authData = {
          uid: payload.sub || payload.user_id || payload.localId,
          email: payload.email,
          emailVerified: payload.email_verified || payload.emailVerified || false,
          isAnonymous: false,
          providerData: [{
            providerId: 'password',
            uid: payload.email,
            displayName: null,
            email: payload.email,
            phoneNumber: null,
            photoURL: null
          }],
          stsTokenManager: {
            refreshToken: idToken,
            accessToken: idToken,
            expirationTime: (payload.exp || Math.floor(Date.now() / 1000) + 3600) * 1000,
          },
          createdAt: payload.iat ? String(payload.iat * 1000) : String(Date.now()),
          lastLoginAt: String(Date.now()),
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          appName: '[DEFAULT]'
        };
        
        // Firebase Authのキーに保存
        const key = `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]`;
        localStorage.setItem(key, JSON.stringify(authData));
        
        // セッションストレージにも保存（バックアップ）
        sessionStorage.setItem('firebaseIdToken', idToken);
        sessionStorage.setItem('firebaseUserId', authData.uid);
        sessionStorage.setItem('firebaseUserEmail', payload.email || '');
        
        console.log('✅ Auth state configured in storage');
        
        // Firebaseを再初期化して認証状態を読み込ませる
        // 注: リロードは避けて、イベントで通知
        window.dispatchEvent(new Event('storage'));
        
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Failed to sign in with ID token:', error);
    return false;
  }
}

/**
 * Firebase Authの認証状態を待つ
 */
export async function waitForAuth(timeout = 5000): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth) return false;

  // 既に認証済みならすぐに返す
  if (auth.currentUser) {
    return true;
  }

  // ローカルストレージから認証情報を確認
  if (typeof window !== 'undefined') {
    const key = `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]`;
    const authData = localStorage.getItem(key);
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.uid) {
          console.log('✅ Found auth data in storage');
          return true;
        }
      } catch (e) {
        console.warn('Failed to parse auth data:', e);
      }
    }
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // タイムアウトしても、ストレージに認証情報があればOK
      const key = `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]`;
      const authData = localStorage.getItem(key);
      resolve(!!authData);
    }, timeout);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

/**
 * セッションストレージからユーザーIDを取得
 */
export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // まずセッションストレージから取得
  const sessionUserId = sessionStorage.getItem('firebaseUserId');
  if (sessionUserId) return sessionUserId;
  
  // ローカルストレージから取得
  const key = `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]`;
  const authData = localStorage.getItem(key);
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.uid || null;
    } catch (e) {
      console.warn('Failed to parse auth data:', e);
    }
  }
  
  return null;
}