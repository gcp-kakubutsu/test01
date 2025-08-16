import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore, isAdminInitialized } from '@/lib/firebase/admin';

// 統一的な有料会員ステータスチェック
export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // セッションクッキーまたはIDトークンを取得
    const sessionCookie = cookieStore.get('session');
    const authToken = cookieStore.get('auth-token');
    
    // LINEブラウザ判定（User-Agentヘッダーから）
    const userAgent = cookieStore.get('user-agent')?.value || '';
    const isLineBrowser = userAgent.toLowerCase().includes('line');
    
    // LINEブラウザの場合は常に有料会員として扱う（一時的な対応）
    if (isLineBrowser) {
      return NextResponse.json({ 
        isPremium: true,
        subscriptionStatus: 'active',
        isLineBrowser: true,
        message: 'LINE browser - premium access granted'
      });
    }
    
    // 認証情報がない場合
    if (!sessionCookie && !authToken) {
      return NextResponse.json({ 
        isPremium: false,
        subscriptionStatus: 'none',
        error: 'No authentication'
      });
    }

    // Firebase Adminが初期化されているか確認
    if (!isAdminInitialized()) {
      console.error('Firebase Admin SDK is not initialized');
      return NextResponse.json({ 
        isPremium: false,
        subscriptionStatus: 'none',
        error: 'Admin SDK not initialized'
      });
    }

    try {
      const adminAuth = getAdminAuth();
      const adminFirestore = getAdminFirestore();
      
      let uid: string | null = null;
      
      // 認証トークンの検証
      if (sessionCookie) {
        try {
          // セッションクッキーとして検証
          const decodedClaims = await adminAuth.verifySessionCookie(
            sessionCookie.value,
            true
          );
          uid = decodedClaims.uid;
        } catch (error: any) {
          // IDトークンとして検証
          if (error.message?.includes('incorrect "iss"')) {
            const decodedClaims = await adminAuth.verifyIdToken(sessionCookie.value, true);
            uid = decodedClaims.uid;
          }
        }
      }
      
      // authTokenがある場合はそちらも試す
      if (!uid && authToken) {
        try {
          const decodedClaims = await adminAuth.verifyIdToken(authToken.value, true);
          uid = decodedClaims.uid;
        } catch (error) {
          console.error('Auth token verification failed:', error);
        }
      }
      
      // UIDが取得できない場合
      if (!uid) {
        return NextResponse.json({ 
          isPremium: false,
          subscriptionStatus: 'none',
          error: 'Invalid authentication'
        });
      }
      
      // Firestoreからユーザー情報を取得
      const userDoc = await adminFirestore
        .collection('users')
        .doc(uid)
        .get();
      
      if (!userDoc.exists) {
        return NextResponse.json({ 
          isPremium: false,
          subscriptionStatus: 'none',
          error: 'User not found'
        });
      }
      
      const userData = userDoc.data();
      
      // 有料会員チェック
      let isPremium = false;
      let subscriptionStatus = 'none';
      let subscriptionEndDate = null;
      
      if (userData?.isPremium) {
        if (userData.subscriptionEndDate) {
          const endDate = userData.subscriptionEndDate.toDate();
          const isActive = endDate > new Date();
          isPremium = isActive;
          subscriptionStatus = isActive ? 'active' : 'expired';
          subscriptionEndDate = endDate.toISOString();
        } else {
          // subscriptionEndDateがない場合も有効とする
          isPremium = true;
          subscriptionStatus = 'active';
        }
      }
      
      // レスポンスヘッダーにキャッシュ制御を追加
      const response = NextResponse.json({ 
        isPremium,
        subscriptionStatus,
        subscriptionEndDate,
        userId: uid
      });
      
      // 1分間キャッシュ
      response.headers.set('Cache-Control', 'private, max-age=60');
      
      return response;
      
    } catch (error: any) {
      console.error('Premium status check error:', error);
      return NextResponse.json({ 
        isPremium: false,
        subscriptionStatus: 'none',
        error: 'Verification failed'
      });
    }
    
  } catch (error: any) {
    console.error('Premium status check error:', error);
    return NextResponse.json({ 
      isPremium: false,
      subscriptionStatus: 'none',
      error: 'Server error'
    }, { status: 500 });
  }
}