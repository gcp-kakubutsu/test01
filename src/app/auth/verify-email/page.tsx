"use client";

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    
    if (!code || mode !== 'verifyEmail') {
      setErrorMessage('無効なリンクです。');
      setIsVerifying(false);
      return;
    }
    
    // メールアドレスを確認
    if (auth) {
      applyActionCode(auth, code)
        .then(() => {
          setIsSuccess(true);
          setIsVerifying(false);
          toast({
            title: '確認完了',
            description: 'メールアドレスが確認されました。ログインできます。'
          });
        })
        .catch((error) => {
          console.error('Email verification error:', error);
          setIsVerifying(false);
          
          let message = 'メールアドレスの確認に失敗しました。';
          if (error.code === 'auth/expired-action-code') {
            message = 'リンクの有効期限が切れています。';
          } else if (error.code === 'auth/invalid-action-code') {
            message = '無効なリンクです。';
          }
          
          setErrorMessage(message);
          toast({
            title: 'エラー',
            description: message,
            variant: 'destructive'
          });
        });
    }
  }, [searchParams, toast]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#F0306A]" />
              <p className="text-gray-600">メールアドレスを確認中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">メールアドレスを確認しました</CardTitle>
            <CardDescription>
              アカウントの設定が完了しました
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-gray-600">
              <p>メールアドレスの確認が完了しました。</p>
              <p>ログインページから新しいアカウントでログインできます。</p>
            </div>
            
            <Button 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              onClick={() => router.push("/login")}
            >
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold">エラーが発生しました</CardTitle>
          <CardDescription>
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p>メールアドレスの確認に問題が発生しました。</p>
            <p>新規登録からやり直してください。</p>
          </div>
          
          <div className="space-y-2">
            <Button 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              onClick={() => router.push("/signup")}
            >
              新規登録へ
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push("/")}
            >
              トップページへ戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#F0306A]" />
              <p className="text-gray-600">読み込み中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}