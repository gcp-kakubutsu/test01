import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

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

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const app = initializeAdmin();
    const auth = getAuth(app);

    // セッションクッキーを検証
    const decodedClaims = await auth.verifySessionCookie(sessionCookie.value, true);

    // ユーザー情報を取得
    const user = await auth.getUser(decodedClaims.uid);

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
      },
    });

  } catch (error: any) {
    console.error('Session check error:', error);
    
    // セッションが無効な場合はクッキーを削除
    const cookieStore = await cookies();
    cookieStore.delete('session');

    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}