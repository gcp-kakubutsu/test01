"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const oobCode = searchParams.get('oobCode');
      const mode = searchParams.get('mode');
      const apiKey = searchParams.get('apiKey');
      const continueUrl = searchParams.get('continueUrl');

      // Firebase標準のパラメータを確認
      if (!oobCode) {
        setStatus('error');
        setMessage('確認コードが見つかりません');
        return;
      }

      try {
        // Firebase Auth REST APIでメール確認
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey || process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              oobCode,
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('メールアドレスの確認が完了しました！');
          
          // 3秒後にログインページへリダイレクト
          setTimeout(() => {
            if (continueUrl) {
              // LINEブラウザ対応：continueUrlがある場合はそちらへ
              window.location.href = continueUrl;
            } else {
              router.push('/login');
            }
          }, 3000);
        } else {
          setStatus('error');
          let errorMessage = '確認に失敗しました';
          
          if (data.error?.message === 'INVALID_OOB_CODE') {
            errorMessage = '確認コードが無効または期限切れです';
          } else if (data.error?.message === 'EMAIL_ALREADY_VERIFIED') {
            errorMessage = 'このメールアドレスは既に確認済みです';
            // 既に確認済みの場合もログインページへ
            setTimeout(() => {
              router.push('/login');
            }, 2000);
          }
          
          setMessage(errorMessage);
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage('確認処理中にエラーが発生しました');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>メールアドレスの確認</CardTitle>
          <CardDescription>
            {status === 'verifying' && 'メールアドレスを確認しています...'}
            {status === 'success' && 'ようこそNukuneへ！'}
            {status === 'error' && 'エラーが発生しました'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'verifying' && (
            <Loader2 className="h-12 w-12 animate-spin text-pink-500" />
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-sm text-gray-600">{message}</p>
              <p className="text-center text-xs text-gray-500">
                ログインページへ自動的にリダイレクトします...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-center text-sm text-gray-600">{message}</p>
              <Button
                onClick={() => router.push('/login')}
                className="bg-pink-500 hover:bg-pink-600"
              >
                ログインページへ
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-pink-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}