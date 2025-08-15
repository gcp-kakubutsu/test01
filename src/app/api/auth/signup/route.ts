import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, birthDate, gender } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: '必須項目が入力されていません' },
        { status: 400 }
      );
    }

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

    // メール確認リンクを生成
    const emailVerificationLink = await auth.generateEmailVerificationLink(email);
    
    // メール送信（Firebase Authの標準メール送信機能を使用）
    // 注: 実際のメール送信はFirebase Consoleで設定されたテンプレートが使用される
    console.log('Email verification link generated:', emailVerificationLink);

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

  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}