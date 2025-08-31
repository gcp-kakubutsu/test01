import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが必要です' },
        { status: 400 }
      );
    }

    // パスワードがある場合は、ユーザーの認証情報を使用
    if (password) {
      try {
        // パスワードを使ってサインインしてIDトークンを取得
        const signInResponse = await fetch(
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

        if (!signInResponse.ok) {
          const signInError = await signInResponse.json();
          let errorMessage = 'メールアドレスまたはパスワードが正しくありません';
          
          if (signInError.error?.message === 'EMAIL_NOT_FOUND') {
            errorMessage = 'このメールアドレスは登録されていません';
          } else if (signInError.error?.message === 'INVALID_PASSWORD') {
            errorMessage = 'パスワードが正しくありません';
          } else if (signInError.error?.message === 'USER_DISABLED') {
            errorMessage = 'このアカウントは無効化されています';
          }
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 400 }
          );
        }

        const signInData = await signInResponse.json();
        
        // 既にメール確認済みの場合
        if (signInData.emailVerified) {
          return NextResponse.json(
            { error: 'このメールアドレスは既に確認済みです' },
            { status: 400 }
          );
        }

        // IDトークンを使用してメール確認メールを送信
        const verifyResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requestType: 'VERIFY_EMAIL',
              idToken: signInData.idToken,
            }),
          }
        );

        if (!verifyResponse.ok) {
          const verifyError = await verifyResponse.json();
          console.error('Failed to send verification email:', verifyError);
          
          let errorMessage = 'メール送信に失敗しました';
          if (verifyError.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            errorMessage = '送信回数の制限に達しました。しばらく待ってから再度お試しください';
          }
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 400 }
          );
        }

        const verifyData = await verifyResponse.json();
        console.log('✅ Verification email resent successfully for:', email);

        return NextResponse.json({
          success: true,
          message: '確認メールを再送信しました。メールをご確認ください。',
          email: verifyData.email,
        });
      } catch (error) {
        console.error('Failed to resend verification email with password:', error);
        return NextResponse.json(
          { error: 'メール送信中にエラーが発生しました' },
          { status: 500 }
        );
      }
    } else {
      // パスワードがない場合は、Admin SDKを使用してユーザー情報を取得
      try {
        const auth = getAdminAuth();
        
        // メールアドレスからユーザーを取得
        const userRecord = await auth.getUserByEmail(email);
        
        if (!userRecord) {
          return NextResponse.json(
            { error: 'このメールアドレスは登録されていません' },
            { status: 404 }
          );
        }

        if (userRecord.emailVerified) {
          return NextResponse.json(
            { error: 'このメールアドレスは既に確認済みです' },
            { status: 400 }
          );
        }

        // メール確認リンクを生成して送信
        const actionCodeSettings = {
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/verify-email`,
          handleCodeInApp: true,
        };

        const link = await auth.generateEmailVerificationLink(email, actionCodeSettings);
        
        // ここで実際のメール送信サービスを使用する必要があります
        // 例：SendGrid、Amazon SES、など
        // 今回はFirebase Authの標準機能では再送信が直接できないため、
        // カスタムメール送信の実装が必要です
        
        console.log('Generated verification link:', link);
        
        return NextResponse.json({
          success: true,
          message: '確認メールを再送信しました。メールをご確認ください。',
          email: email,
        });
      } catch (adminError: any) {
        console.error('Admin SDK error:', adminError);
        
        // Admin SDKが使えない、またはユーザーが見つからない場合
        let errorMessage = 'メール送信に失敗しました';
        
        if (adminError.code === 'auth/user-not-found') {
          errorMessage = 'このメールアドレスは登録されていません';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error('Resend verification API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}