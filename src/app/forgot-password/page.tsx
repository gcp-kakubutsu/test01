"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { isLineApp } from '@/lib/utils/browser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLine, setIsLine] = useState(false);
  const [showLineWarning, setShowLineWarning] = useState(false);

  useEffect(() => {
    // Check if running in LINE browser
    const lineApp = isLineApp();
    setIsLine(lineApp);
    if (lineApp) {
      setShowLineWarning(true);
      // Auto-hide warning after 10 seconds
      const timer = setTimeout(() => setShowLineWarning(false), 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({ 
        title: "入力エラー", 
        description: "メールアドレスを入力してください。", 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (!auth) {
        toast({ 
          title: "エラー", 
          description: "認証サービスが利用できません。", 
          variant: "destructive" 
        });
        return;
      }

      await sendPasswordResetEmail(auth, email);
      
      setIsEmailSent(true);
      toast({ 
        title: "送信完了", 
        description: "パスワードリセットメールを送信しました。メールをご確認ください。" 
      });
    } catch (error: any) {
      let description = "パスワードリセットメールの送信に失敗しました。";
      
      if (error.code === 'auth/user-not-found') {
        description = "このメールアドレスは登録されていません。";
      } else if (error.code === 'auth/invalid-email') {
        description = "メールアドレスの形式が正しくありません。";
      } else if (error.code === 'auth/too-many-requests') {
        description = "リクエストが多すぎます。しばらくしてから再度お試しください。";
      }
      
      toast({ 
        title: "エラー", 
        description, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">メールを送信しました</CardTitle>
            <CardDescription>
              パスワードリセット用のリンクをメールで送信しました
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-gray-600 space-y-2">
              <p>メール内のリンクをクリックして、新しいパスワードを設定してください。</p>
              <p>メールアドレスの確認も同時に完了します。</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
              <p className="font-semibold mb-2">メールが届かない場合：</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>迷惑メールフォルダをご確認ください</li>
                <li>メールアドレスが正しく入力されているか確認してください</li>
                <li>数分待ってもメールが届かない場合は、再度お試しください</li>
              </ul>
            </div>

            <Button 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              onClick={() => router.push("/login")}
            >
              ログインページへ戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex flex-col items-center justify-center px-4">
      {showLineWarning && isLine && (
        <Alert className="mb-4 max-w-md w-full border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">LINEブラウザをご利用中です</AlertTitle>
          <AlertDescription className="text-yellow-700">
            より快適にご利用いただくため、Safari、Chrome等の標準ブラウザでの利用を推奨します。
            <button
              onClick={() => {
                const currentUrl = window.location.href;
                window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent('Nukuneを開く\n' + currentUrl)}`;
              }}
              className="mt-2 text-blue-600 underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              標準ブラウザで開く
            </button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="max-w-md w-full">
        <CardHeader>
          <Link href="/login" className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            ログインに戻る
          </Link>
          <CardTitle className="text-2xl font-bold">パスワードをリセット</CardTitle>
          <CardDescription>
            登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="text-sm text-gray-600">
              <p>メールアドレスが未確認の場合も、このリンクから確認できます。</p>
            </div>
          </CardContent>
          <CardContent>
            <Button 
              type="submit" 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                'リセットメールを送信'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}