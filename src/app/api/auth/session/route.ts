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
        user: null,
      });
    }

    try {
      const auth = getAdminAuth();
      
      // セッションクッキーを検証
      const decodedClaims = await auth.verifySessionCookie(sessionCookie.value, true);

      // ユーザー情報を取得
      try {
        const user = await auth.getUser(decodedClaims.uid);
        
        return NextResponse.json({
          authenticated: true,
          user: {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
          },
        });
      } catch (getUserError) {
        console.warn('Could not get user record:', getUserError);
        // getUserが失敗しても基本情報を返す
        return NextResponse.json({
          authenticated: true,
          user: {
            uid: decodedClaims.uid,
            email: decodedClaims.email,
            emailVerified: decodedClaims.email_verified || false,
            displayName: null,
          },
        });
      }
    } catch (error) {
      console.warn('Session verification with Admin SDK failed, trying to decode token directly:', error);
      
      // Admin SDKが利用できない場合、IDトークンとして扱う
      try {
        // IDトークンをデコード（簡易的な検証）
        const payload = JSON.parse(
          Buffer.from(sessionCookie.value.split('.')[1], 'base64').toString()
        );
        
        // 有効期限チェック
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          throw new Error('Token expired');
        }
        
        return NextResponse.json({
          authenticated: true,
          user: {
            uid: payload.sub || payload.user_id,
            email: payload.email,
            emailVerified: payload.email_verified || false,
            displayName: payload.name || null,
          },
        });
      } catch (decodeError) {
        console.error('Failed to decode session token:', decodeError);
        
        // セッションが無効な場合はクッキーを削除
        cookieStore.delete('session');

        return NextResponse.json({
          authenticated: false,
          user: null,
        });
      }
    }

  } catch (error: any) {
    console.error('Session check error:', error);
    
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}