import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // セッションクッキーを削除
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // LINEブラウザ対応のため、明示的にクッキーを上書き
    cookieStore.set('session', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 0, // 即座に削除
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: 'ログアウトしました',
    });

  } catch (error: any) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'ログアウトに失敗しました' },
      { status: 500 }
    );
  }
}