import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードが必要です' },
        { status: 400 }
      );
    }

    // Firebase AuthのREST APIを使用してユーザー認証
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

    // Admin SDKが利用可能か確認
    let sessionCookie = data.idToken; // デフォルトはIDトークンを使用
    let customToken = data.idToken;
    let emailVerified = data.emailVerified || false;
    let uid = data.localId;
    
    try {
      // Firebase Admin SDKでIDトークンを検証
      const auth = getAdminAuth();
      const decodedToken = await auth.verifyIdToken(data.idToken);
      uid = decodedToken.uid;
      
      // メール確認チェック
      try {
        const userRecord = await auth.getUser(decodedToken.uid);
        emailVerified = userRecord.emailVerified;
        
        if (!emailVerified) {
          // 開発環境では警告のみ
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Email not verified for user:', userRecord.email);
          } else {
            return NextResponse.json(
              { error: 'メールアドレスの確認が完了していません' },
              { status: 403 }
            );
          }
        }
      } catch (getUserError) {
        console.warn('Could not get user record:', getUserError);
        // getUserが失敗しても続行
      }
      
      // カスタムセッショントークンを作成
      try {
        sessionCookie = await auth.createSessionCookie(data.idToken, {
          expiresIn: 60 * 60 * 24 * 1000, // 24時間
        });
      } catch (sessionError) {
        console.warn('Could not create session cookie:', sessionError);
        // セッションクッキー作成に失敗しても、IDトークンを使用
      }
      
      // カスタムトークンを生成
      try {
        customToken = await auth.createCustomToken(uid);
      } catch (customTokenError) {
        console.warn('Could not create custom token:', customTokenError);
        // カスタムトークン作成に失敗しても、IDトークンを使用
      }
    } catch (error) {
      console.warn('Admin SDK not available, using ID token directly:', error);
      // Admin SDKが利用できない場合は、IDトークンを直接使用
    }

    // クッキーに保存
    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
      path: '/',
    });

    // ユーザー情報を返す
    return NextResponse.json({
      success: true,
      user: {
        uid: uid,
        email: data.email,
        emailVerified: emailVerified,
      },
      customToken,
    });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}