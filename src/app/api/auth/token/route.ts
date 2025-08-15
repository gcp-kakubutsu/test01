import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        customToken: null,
      });
    }

    try {
      const auth = getAdminAuth();
      
      // セッションクッキーを検証
      const decodedClaims = await auth.verifySessionCookie(sessionCookie.value, true);

      // カスタムトークンを生成（Firestore認証用）
      const customToken = await auth.createCustomToken(decodedClaims.uid);

      return NextResponse.json({
        authenticated: true,
        customToken,
      });
    } catch (error) {
      console.warn('Token generation with Admin SDK failed, using session cookie as token:', error);
      
      // Admin SDKが利用できない場合、セッションクッキーをそのまま返す
      return NextResponse.json({
        authenticated: true,
        customToken: sessionCookie.value, // IDトークンとして使用
      });
    }

  } catch (error: any) {
    console.error('Token API error:', error);
    
    return NextResponse.json({
      authenticated: false,
      customToken: null,
    });
  }
}