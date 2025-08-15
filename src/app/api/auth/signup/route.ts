import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin初期化
function initializeAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

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

  return initializeApp({
    projectId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, birthDate, gender } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: '必須項目が入力されていません' },
        { status: 400 }
      );
    }

    const app = initializeAdmin();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Firebase AuthのREST APIを使用してユーザー作成
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
      } else if (data.error?.message === 'WEAK_PASSWORD') {
        errorMessage = 'パスワードは6文字以上で設定してください';
      } else if (data.error?.message === 'INVALID_EMAIL') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // メール確認を送信
    await fetch(
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

    // Firestoreにユーザー情報を保存
    const userRef = db.collection('users').doc(data.localId);
    await userRef.set({
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
        uid: data.localId,
        email: data.email,
      },
    });

  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}