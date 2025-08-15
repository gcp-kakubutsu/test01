import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

    // セッションクッキー（IDトークン）をそのまま返す（高速化）
    // Firebase Authはこのトークンを直接使用可能
    return NextResponse.json({
      authenticated: true,
      customToken: sessionCookie.value,
    });

  } catch (error: any) {
    console.error('Token API error:', error);
    
    return NextResponse.json({
      authenticated: false,
      customToken: null,
    });
  }
}