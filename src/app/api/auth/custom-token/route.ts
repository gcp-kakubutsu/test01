import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

// Next.jsのキャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        customToken: null,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
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
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      } catch (adminError) {
        console.warn('Admin SDK not available, returning ID token:', adminError);
        // Admin SDKが使えない場合は、IDトークンを返す
        return NextResponse.json({
          authenticated: true,
          customToken: sessionCookie.value,
          uid,
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
    } catch (error) {
      console.error('Token processing error:', error);
      
      return NextResponse.json({
        authenticated: false,
        customToken: null,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
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