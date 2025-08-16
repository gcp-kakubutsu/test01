import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore, isAdminInitialized } from '@/lib/firebase/admin';

// セッションベースで有料会員状態をチェック（LINEブラウザ対応）
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ 
        isPremium: false, 
        subscriptionStatus: 'none',
        error: 'No session'
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
      // Firebase Admin Auth/Firestoreインスタンスを取得
      const adminAuth = getAdminAuth();
      const adminFirestore = getAdminFirestore();
      
      // IDトークンとして検証（セッションクッキーではなくIDトークンが保存されている場合）
      let decodedClaims;
      try {
        // まずセッションクッキーとして検証を試みる
        decodedClaims = await adminAuth.verifySessionCookie(
          sessionCookie.value,
          true
        );
      } catch (error: any) {
        // セッションクッキーとして無効な場合、IDトークンとして検証
        if (error.code === 'auth/argument-error' || error.message?.includes('incorrect "iss"')) {
          decodedClaims = await adminAuth.verifyIdToken(sessionCookie.value, true);
        } else {
          throw error;
        }
      }
      
      // Firestoreから直接ユーザー情報を取得
      const userDoc = await adminFirestore
        .collection('users')
        .doc(decodedClaims.uid)
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
      
      return NextResponse.json({ 
        isPremium,
        subscriptionStatus,
        subscriptionEndDate,
        userId: decodedClaims.uid,
        email: decodedClaims.email
      });
      
    } catch (error: any) {
      console.error('Session verification error:', error);
      return NextResponse.json({ 
        isPremium: false, 
        subscriptionStatus: 'none',
        error: 'Invalid session'
      });
    }
    
  } catch (error: any) {
    console.error('Subscription check error:', error);
    return NextResponse.json({ 
      isPremium: false, 
      subscriptionStatus: 'none',
      error: 'Server error'
    }, { status: 500 });
  }
}