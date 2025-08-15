import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードが必要です' },
        { status: 400 }
      );
    }

    // Firebase AuthのREST APIを使用してユーザー認証（高速）
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      let errorMessage = 'ログインに失敗しました';
      
      if (data.error?.message === 'EMAIL_NOT_FOUND' || data.error?.message === 'INVALID_PASSWORD') {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません';
      } else if (data.error?.message === 'USER_DISABLED') {
        errorMessage = 'このアカウントは無効化されています';
      } else if (data.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        errorMessage = 'ログイン試行回数が多すぎます。しばらくしてから再度お試しください';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // メール確認チェック - 高速化のため最初のレスポンスを信頼
    const emailVerified = data.emailVerified || false;
    
    if (!emailVerified) {
      console.warn('⚠️ Email not verified for user:', data.email);
      // メール未確認でもログインは許可（警告のみ）
      // 後でバックグラウンドでメール確認リンクを再送信
      fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestType: 'VERIFY_EMAIL',
            idToken: data.idToken,
          }),
        }
      ).catch(err => console.log('Background email verification send:', err));
    }

    // IDトークンを直接セッションクッキーとして保存（高速化）
    const cookieStore = await cookies();
    cookieStore.set('session', data.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseInt(data.expiresIn) || 3600, // expiresInの値を使用（デフォルト1時間）
      path: '/',
    });

    // ユーザー情報を返す
    return NextResponse.json({
      success: true,
      user: {
        uid: data.localId,
        email: data.email,
        emailVerified: emailVerified,
      },
      customToken: data.idToken, // Firebase Authで直接使用
    });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}