import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      // キャッシュを無効化して常に最新の状態を返す
      return NextResponse.json({
        authenticated: false,
        user: null,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // まずIDトークンとして高速デコード
    try {
      const parts = sessionCookie.value.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString()
      );
      
      // 有効期限チェック
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        // トークンが期限切れ
        cookieStore.delete('session');
        return NextResponse.json({
          authenticated: false,
          user: null,
        });
      }
      
      // 即座にユーザー情報を返す（Admin SDK検証をスキップして高速化）
      return NextResponse.json({
        authenticated: true,
        user: {
          uid: payload.sub || payload.user_id || payload.localId,
          email: payload.email,
          emailVerified: payload.email_verified || payload.emailVerified || false,
          displayName: payload.name || null,
        },
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch (error) {
      console.error('Failed to decode session token:', error);
      
      // セッションが無効な場合はクッキーを削除
      cookieStore.delete('session');

      return NextResponse.json({
        authenticated: false,
        user: null,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

  } catch (error: any) {
    console.error('Session check error:', error);
    
    return NextResponse.json({
      authenticated: false,
      user: null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}