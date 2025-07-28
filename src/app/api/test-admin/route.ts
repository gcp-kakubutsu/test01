import { NextResponse } from 'next/server';
import { isAdminInitialized } from '@/lib/firebase/admin';

export async function GET() {
  const initialized = isAdminInitialized();
  
  return NextResponse.json({
    initialized,
    env: {
      hasGoogleCreds: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      hasAdminProjectId: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      hasAdminClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      hasAdminPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    },
    cwd: process.cwd(),
  });
}