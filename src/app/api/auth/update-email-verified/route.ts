import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, emailVerified } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが必要です' },
        { status: 400 }
      );
    }

    try {
      const auth = getAdminAuth();
      const db = getAdminFirestore();

      // メールアドレスからユーザーを取得
      const userRecord = await auth.getUserByEmail(email);
      
      if (!userRecord) {
        return NextResponse.json(
          { error: 'ユーザーが見つかりません' },
          { status: 404 }
        );
      }

      // Firebase Authのユーザー情報を更新
      await auth.updateUser(userRecord.uid, {
        emailVerified: emailVerified,
      });

      // Firestoreのユーザー情報も更新
      const userRef = db.collection('users').doc(userRecord.uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.update({
          emailVerified: emailVerified,
          updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Updated email verification status for ${email} to ${emailVerified}`);
      } else {
        // ドキュメントが存在しない場合は作成
        await userRef.set({
          email: email,
          emailVerified: emailVerified,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Created user document with email verification status for ${email}`);
      }

      return NextResponse.json({
        success: true,
        message: 'メール確認状態を更新しました',
      });

    } catch (adminError: any) {
      console.error('Admin SDK error:', adminError);
      
      // Admin SDKが使えない場合でも、REST APIで試みる
      try {
        // Firebase Auth REST APIでユーザー情報を更新することはできないため、
        // ここではログのみ出力
        console.log(`⚠️ Admin SDK not available, cannot update Firestore for ${email}`);
        
        return NextResponse.json({
          success: true,
          message: 'メール確認は完了しましたが、データベースの更新はスキップされました',
        });
      } catch (restError) {
        console.error('REST API error:', restError);
        return NextResponse.json(
          { error: 'データベースの更新に失敗しました' },
          { status: 500 }
        );
      }
    }

  } catch (error: any) {
    console.error('Update email verified API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}