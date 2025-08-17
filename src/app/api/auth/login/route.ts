import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Next.jsのキャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
    
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
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeoutId));

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
      // メール確認リンクの再送信はしない（ユーザーが不快に感じるため）
      // 必要な場合はユーザーが手動でリクエストできるようにする
    } else {
      console.log('✅ Email already verified for user:', data.email);
    }

    // IDトークンを直接セッションクッキーとして保存（高速化）
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // LINEブラウザを含むすべてのブラウザで動作するよう設定
    // 本番環境ではsameSite='none'でLINEブラウザ対応
    cookieStore.set('session', data.idToken, {
      httpOnly: true,
      secure: true, // HTTPSで必須（本番・ngrok両方で有効）
      sameSite: isProduction ? 'none' : 'lax', // 本番環境ではnoneでLINE対応
      maxAge: parseInt(data.expiresIn) || 3600, // expiresInの値を使用（デフォルト1時間）
      path: '/',
      priority: 'high' as const, // 優先度を高に設定
    });

    // Firestoreにユーザーデータが存在するか確認し、ない場合は作成
    try {
      const { getAdminFirestore, isAdminInitialized } = await import('@/lib/firebase/admin');
      
      if (isAdminInitialized()) {
        const adminFirestore = getAdminFirestore();
        const userRef = adminFirestore.collection('users').doc(data.localId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          console.log('[Login] Creating missing user document in Firestore for:', data.email);
          // ユーザードキュメントが存在しない場合は作成
          await userRef.set({
            email: data.email,
            emailVerified: emailVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPremium: false, // デフォルトは無料会員
            subscriptionStatus: 'none',
          });
        } else {
          console.log('[Login] User document exists in Firestore');
        }
      }
    } catch (firestoreError) {
      console.error('[Login] Failed to check/create Firestore user document:', firestoreError);
      // Firestoreエラーがあってもログインは続行
    }
    
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
    
    // タイムアウトエラーの場合
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'ログインがタイムアウトしました。再度お試しください。' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}