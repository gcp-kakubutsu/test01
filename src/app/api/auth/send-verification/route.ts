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

    // メール確認メールを送信（メールアドレスのみを使用）
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'VERIFY_EMAIL',
          email,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to send verification email:', data);
      
      // エラーでも成功として返す（ユーザー作成は成功している）
      return NextResponse.json({
        success: true,
        message: 'アカウントが作成されました',
      });
    }

    console.log('✅ Verification email sent successfully');
    return NextResponse.json({
      success: true,
      message: 'メール確認メールを送信しました',
    });

  } catch (error: any) {
    console.error('Send verification API error:', error);
    // エラーでも成功として返す
    return NextResponse.json({
      success: true,
      message: 'アカウントが作成されました',
    });
  }
}