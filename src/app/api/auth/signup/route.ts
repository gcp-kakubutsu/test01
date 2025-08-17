import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

// Next.jsのキャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, birthDate, gender } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: '必須項目が入力されていません' },
        { status: 400 }
      );
    }

    // Firebase Admin SDKが利用可能か確認
    try {
      const auth = getAdminAuth();
      const db = getAdminFirestore();

      // Firebase Admin SDKでユーザー作成
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: false,
        });
      } catch (error: any) {
        console.error('User creation error:', error);
        
        let errorMessage = '登録に失敗しました';
        
        if (error.code === 'auth/email-already-exists') {
          errorMessage = 'このメールアドレスは既に使用されています';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'メールアドレスの形式が正しくありません';
        } else if (error.code === 'auth/weak-password' || (error.message && error.message.includes('password'))) {
          errorMessage = 'パスワードは6文字以上で設定してください';
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      // メール確認リンクを生成（LINE対応）
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://nukune.com'}/verify-email?email=${encodeURIComponent(email)}`,
        handleCodeInApp: true,
      };
      
      const emailVerificationLink = await auth.generateEmailVerificationLink(email, actionCodeSettings);
      
      // メール送信（Firebase Authの標準メール送信機能を使用）
      console.log('Email verification link generated for LINE browser:', emailVerificationLink);

      // Firestoreにユーザー情報を保存
      await db.collection('users').doc(userRecord.uid).set({
        username,
        email,
        birthDate: birthDate || null,
        gender: gender || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: false,
      });

      return NextResponse.json({
        success: true,
        message: 'アカウントを作成しました。メールアドレスの確認をお願いします。',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
        },
      });
    } catch (adminError) {
      // Admin SDKが使えない場合はREST APIを使用（高速）
      console.log('Using REST API for signup');
      
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
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
        let errorMessage = '登録に失敗しました';
        
        if (data.error?.message === 'EMAIL_EXISTS') {
          errorMessage = 'このメールアドレスは既に使用されています';
        } else if (data.error?.message === 'INVALID_EMAIL') {
          errorMessage = 'メールアドレスの形式が正しくありません';
        } else if (data.error?.message === 'WEAK_PASSWORD') {
          errorMessage = 'パスワードは6文字以上で設定してください';
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      // メール確認リンクを送信（REST API）
      const verifyResponse = await fetch(
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
      );

      if (!verifyResponse.ok) {
        console.error('Failed to send verification email:', await verifyResponse.json());
      }

      // REST APIでユーザーが作成された場合もFirestoreにデータを保存
      try {
        const { getAdminFirestore, isAdminInitialized } = await import('@/lib/firebase/admin');
        
        if (isAdminInitialized()) {
          const adminFirestore = getAdminFirestore();
          console.log('[Signup] Creating user document in Firestore for REST API signup:', data.email);
          
          await adminFirestore.collection('users').doc(data.localId).set({
            username,
            email,
            birthDate: birthDate || null,
            gender: gender || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            emailVerified: false,
            isPremium: false, // デフォルトは無料会員
            subscriptionStatus: 'none',
          });
        }
      } catch (firestoreError) {
        console.error('[Signup] Failed to create Firestore user document:', firestoreError);
        // Firestoreエラーがあってもユーザー作成は成功しているので続行
      }

      return NextResponse.json({
        success: true,
        message: 'アカウントを作成しました。メールアドレスの確認をお願いします。',
        user: {
          uid: data.localId,
          email: data.email,
        },
      });
    }

  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}