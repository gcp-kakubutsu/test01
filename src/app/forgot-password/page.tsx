"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

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
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({ 
          title: "エラー", 
          description: result.error || "パスワードリセットメールの送信に失敗しました", 
          variant: "destructive" 
        });
        return;
      }
      
      setIsEmailSent(true);
      toast({ 
        title: "送信完了", 
        description: "パスワードリセットメールを送信しました。メールをご確認ください。" 
      });
    } catch (error: any) {
      toast({ 
        title: "エラー", 
        description: "ネットワークエラーが発生しました。", 
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
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
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