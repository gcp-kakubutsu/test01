import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore, isAdminInitialized } from '@/lib/firebase/admin';

export async function GET() {
  try {
    console.log('[Session Check API] Starting session check');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    console.log('[Session Check API] Session cookie found:', !!sessionCookie);
    
    if (!sessionCookie) {
      return NextResponse.json({ 
        isAuthenticated: false,
        userId: null,
        isPremium: false
      });
    }

    // Firebase Adminが初期化されているか確認
    if (!isAdminInitialized()) {
      console.error('[Session Check] Firebase Admin SDK is not initialized');
      return NextResponse.json({ 
        isAuthenticated: false,
        userId: null,
        isPremium: false
      });
    }

    try {
      const adminAuth = getAdminAuth();
      const adminFirestore = getAdminFirestore();
      
      // セッションクッキーまたはIDトークンを検証
      let decodedClaims;
      try {
        decodedClaims = await adminAuth.verifySessionCookie(
          sessionCookie.value,
          true
        );
      } catch (error: any) {
        if (error.code === 'auth/argument-error' || error.message?.includes('incorrect "iss"')) {
          decodedClaims = await adminAuth.verifyIdToken(sessionCookie.value, true);
        } else {
          throw error;
        }
      }
      
      // Firestoreからユーザー情報を取得
      const userDoc = await adminFirestore
        .collection('users')
        .doc(decodedClaims.uid)
        .get();
      
      let isPremium = false;
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('[Session Check API] User data:', {
          uid: decodedClaims.uid,
          isPremium: userData?.isPremium,
          hasEndDate: !!userData?.subscriptionEndDate
        });
        if (userData?.isPremium) {
          if (userData.subscriptionEndDate) {
            const endDate = userData.subscriptionEndDate.toDate();
            isPremium = endDate > new Date();
          } else {
            isPremium = true;
          }
        }
      }
      
      console.log('[Session Check API] Final result:', {
        isAuthenticated: true,
        userId: decodedClaims.uid,
        isPremium
      });
      
      return NextResponse.json({ 
        isAuthenticated: true,
        userId: decodedClaims.uid,
        email: decodedClaims.email,
        isPremium
      });
      
    } catch (error: any) {
      console.error('[Session Check] Token verification error:', error);
      return NextResponse.json({ 
        isAuthenticated: false,
        userId: null,
        isPremium: false
      });
    }
    
  } catch (error: any) {
    console.error('[Session Check] Error:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      userId: null,
      isPremium: false
    }, { status: 500 });
  }
}