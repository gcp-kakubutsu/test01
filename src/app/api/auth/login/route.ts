import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

// Firebase Admin初期化
function initializeAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 環境変数から認証情報を取得
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  // サービスアカウント認証がある場合
  if (clientEmail && privateKey) {
    const serviceAccount: ServiceAccount = {
      projectId,
      clientEmail,
      privateKey,
    };

    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  }

  // Google Cloud環境の場合（App Hosting等）
  return initializeApp({
    projectId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードが必要です' },
        { status: 400 }
      );
    }

    // Firebase Adminを初期化
    const app = initializeAdmin();
    const auth = getAuth(app);

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

    // IDトークンを検証
    const decodedToken = await auth.verifyIdToken(data.idToken);
    
    // メール確認チェック
    if (!decodedToken.email_verified) {
      return NextResponse.json(
        { error: 'メールアドレスの確認が完了していません' },
        { status: 403 }
      );
    }

    // カスタムセッショントークンを作成（24時間有効）
    const sessionCookie = await auth.createSessionCookie(data.idToken, {
      expiresIn: 60 * 60 * 24 * 1000, // 24時間
    });

    // クッキーに保存
    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
      path: '/',
    });

    // カスタムトークンも生成（Firestore認証用）
    const customToken = await auth.createCustomToken(decodedToken.uid);

    // ユーザー情報を返す
    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
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