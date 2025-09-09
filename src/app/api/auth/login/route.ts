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

    // メール確認チェック・電話番号確認チェック用に最新ユーザー情報を取得
    let emailVerified = data.emailVerified || false;
    let phoneVerified = false;
    
    try {
      const userLookupResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken: data.idToken,
          }),
        }
      );
      
      if (userLookupResponse.ok) {
        const lookupData = await userLookupResponse.json();
        if (lookupData.users && lookupData.users.length > 0) {
          const u = lookupData.users[0];
          emailVerified = !!u.emailVerified;
          // phoneNumber が存在すれば電話番号はリンク済み（=SMS確認済み）
          phoneVerified = !!u.phoneNumber;
          console.log(`📧 emailVerified=${emailVerified} 📱 phoneVerified=${phoneVerified}`);
        }
      }
    } catch (lookupError) {
      console.error('Failed to lookup user verification status:', lookupError);
      // 取得失敗時は data の値を用いる（phoneVerified は false のまま）
    }
    
    if (!emailVerified) {
      console.warn('❌ Email not verified for user:', data.email);
      // メール未確認の場合はログインを拒否
      return NextResponse.json(
        { 
          error: 'メールアドレスの確認が必要です',
          message: '登録時に送信された確認メールをご確認ください。メール内のリンクをクリックして、メールアドレスの確認を完了してください。',
          emailNotVerified: true,
          email: data.email
        },
        { status: 403 }
      );
    } else {
      console.log('✅ Email verified for user:', data.email);
    }

    // 電話番号未確認の場合はアプリ本体へのアクセスをブロックし、
    // verify-phone ページでの紐付けを促す。
    // ただし、電話番号リンク処理には Firebase クライアントでのサインインが必要なため、
    // セッションクッキーは設定した上でフラグを返す。

    // IDトークンを直接セッションクッキーとして保存（高速化）
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // LINEブラウザを含むすべてのブラウザで動作するよう設定
    // sameSiteをlaxに設定してLINEブラウザでも動作するように
    cookieStore.set('session', data.idToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // LINEブラウザでも動作するようlaxに統一
      maxAge: parseInt(data.expiresIn) || 3600, // expiresInの値を使用（デフォルト1時間）
      path: '/',
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
            phoneVerified: phoneVerified,
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
      phoneVerified,
      phoneNotVerified: !phoneVerified,
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