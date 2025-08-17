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
      // IDトークンからユーザー情報を抽出
      const parts = sessionCookie.value.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString()
      );

      const uid = payload.sub || payload.user_id || payload.localId;
      
      if (!uid) {
        throw new Error('No user ID in token');
      }

      // Admin SDKでカスタムトークンを生成（利用可能な場合）
      try {
        const auth = getAdminAuth();
        const customToken = await auth.createCustomToken(uid);
        
        return NextResponse.json({
          authenticated: true,
          customToken,
          uid,
        });
      } catch (adminError) {
        console.warn('Admin SDK not available, returning ID token:', adminError);
        // Admin SDKが使えない場合は、IDトークンを返す
        return NextResponse.json({
          authenticated: true,
          customToken: sessionCookie.value,
          uid,
        });
      }
    } catch (error) {
      console.error('Token processing error:', error);
      
      return NextResponse.json({
        authenticated: false,
        customToken: null,
      });
    }

  } catch (error: any) {
    console.error('Custom token API error:', error);
    
    return NextResponse.json({
      authenticated: false,
      customToken: null,
    });
  }
}