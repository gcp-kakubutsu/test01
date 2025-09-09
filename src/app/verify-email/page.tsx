"use client";

/**
 * @file メール確認（待機/検証/結果）ページ
 * @summary メール確認リンクの有無に応じて待機/検証/結果の各UIを表示します。
 * 待機画面の案内文は、モバイルでの視認性向上のため指定位置で改行するよう明示しました。
 * @limitations 画面幅に関係なく明示した箇所で改行されます。
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Mail, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * メールアドレス確認フローのUIと状態管理を行うコンポーネント。
 * @returns {JSX.Element} 表示用のReact要素
 */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<'waiting' | 'verifying' | 'success' | 'error'>('waiting');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      const oobCode = searchParams.get('oobCode');
      const mode = searchParams.get('mode');
      const apiKey = searchParams.get('apiKey');
      const continueUrl = searchParams.get('continueUrl');

      // Firebase標準のパラメータを確認
      if (!oobCode) {
        // 確認コードがない場合は、メール待ち画面を表示
        setStatus('waiting');
        setMessage('メールを確認してください');
        return;
      }
      
      setStatus('verifying');

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
          
          // メール認証成功後、Firestoreのユーザー情報を更新
          if (data.email) {
            try {
              // サーバー側でFirestoreを更新
              const updateResponse = await fetch('/api/auth/update-email-verified', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: data.email,
                  emailVerified: true,
                }),
              });
              
              if (updateResponse.ok) {
                console.log('✅ User email verification status updated in Firestore');
              }
            } catch (updateError) {
              console.error('Failed to update Firestore:', updateError);
              // Firestore更新に失敗してもメール認証自体は成功しているので続行
            }
          }
          
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

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: '送信完了',
          description: data.message || '確認メールを再送信しました',
        });
        setShowResendForm(false);
        setEmail('');
        setPassword('');
      } else {
        toast({
          title: 'エラー',
          description: data.error || 'メール送信に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Resend email error:', error);
      toast({
        title: 'エラー',
        description: 'メール送信中にエラーが発生しました',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>メールアドレスの確認</CardTitle>
          <CardDescription>
            {status === 'waiting' && 'メール確認'}
            {status === 'verifying' && 'メールアドレスを確認しています...'}
            {status === 'success' && 'ようこそNukuneへ！'}
            {status === 'error' && 'エラーが発生しました'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'waiting' && !showResendForm && (
            <>
              <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-pink-500" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600 leading-relaxed">
                  登録いただいたメールアドレスに確認メールを{'　'}<br />
                  送信しました。
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  メール内のリンクをクリックして、アカウントの<br />
                  登録を完了してください。
                </p>
                <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                  メールが届かない場合は、迷惑メールフォルダを<br />
                  ご確認ください。
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => setShowResendForm(true)}
                  className="bg-pink-500 hover:bg-pink-600 w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  確認メールを再送信
                </Button>
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="w-full"
                >
                  ログインページへ戻る
                </Button>
              </div>
            </>
          )}

          {status === 'waiting' && showResendForm && (
            <>
              <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-pink-500" />
              </div>
              <form onSubmit={handleResendEmail} className="w-full space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isResending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isResending}
                  />
                  <p className="text-xs text-gray-500">
                    アカウント作成時のパスワードを入力してください
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isResending}
                    className="bg-pink-500 hover:bg-pink-600 flex-1"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        メールを再送信
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResendForm(false);
                      setEmail('');
                      setPassword('');
                    }}
                    disabled={isResending}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </>
          )}
          
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
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => {
                    setStatus('waiting');
                    setMessage('');
                    setShowResendForm(true);
                  }}
                  className="bg-pink-500 hover:bg-pink-600 w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  確認メールを再送信
                </Button>
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="w-full"
                >
                  ログインページへ
                </Button>
              </div>
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