import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが必要です' },
        { status: 400 }
      );
    }

    // Firebase AuthのREST APIを使用してパスワードリセットメールを送信
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      let errorMessage = 'パスワードリセットメールの送信に失敗しました';
      
      if (data.error?.message === 'EMAIL_NOT_FOUND') {
        errorMessage = 'このメールアドレスは登録されていません';
      } else if (data.error?.message === 'INVALID_EMAIL') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      } else if (data.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        errorMessage = 'リクエストが多すぎます。しばらくしてから再度お試しください';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'パスワードリセットメールを送信しました',
    });

  } catch (error: any) {
    console.error('Forgot password API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}