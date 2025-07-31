"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthActionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const apiKey = searchParams.get('apiKey');
    const lang = searchParams.get('lang') || 'ja';

    if (!mode || !oobCode) {
      router.push('/');
      return;
    }

    // Firebase Auth アクションに基づいてリダイレクト
    switch (mode) {
      case 'resetPassword':
        // パスワードリセット
        router.push(`/auth/reset-password?mode=${mode}&oobCode=${oobCode}&apiKey=${apiKey}&lang=${lang}`);
        break;
      case 'verifyEmail':
        // メール確認
        router.push(`/auth/verify-email?mode=${mode}&oobCode=${oobCode}&apiKey=${apiKey}&lang=${lang}`);
        break;
      case 'recoverEmail':
        // メールアドレス復元
        router.push(`/auth/recover-email?mode=${mode}&oobCode=${oobCode}&apiKey=${apiKey}&lang=${lang}`);
        break;
      default:
        router.push('/');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#F0306A]" />
        <p className="text-gray-600">リダイレクト中...</p>
      </div>
    </div>
  );
}