import { getFirebaseAuth } from './client';

/**
 * IDトークンを使用してFirebase Authの認証状態を同期
 */
export async function syncFirebaseAuth(idToken: string): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn('Firebase Auth not available');
      return false;
    }

    // Firebase Auth REST APIを使用してユーザー情報を取得
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
        }),
      }
    );

    if (!response.ok) {
      console.warn('Failed to verify ID token');
      return false;
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      console.log('✅ ID token is valid, user:', data.users[0].email);
      
      // IDトークンをローカルストレージに保存（Firestore SDKが使用）
      if (typeof window !== 'undefined') {
        localStorage.setItem('firebase:authUser:' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY + ':[DEFAULT]', JSON.stringify({
          uid: data.users[0].localId,
          email: data.users[0].email,
          emailVerified: data.users[0].emailVerified,
          isAnonymous: false,
          stsTokenManager: {
            accessToken: idToken,
            refreshToken: '',
            expirationTime: Date.now() + 3600000, // 1時間後
          },
        }));
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to sync Firebase Auth:', error);
    return false;
  }
}