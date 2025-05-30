
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect } from 'react';
import { UserPlus, Mail, KeyRound, UserCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const { signup, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/profile/edit'); // Or /home, depending on desired flow
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "パスワードエラー", description: "パスワードが一致しません。", variant: "destructive" });
      return;
    }
    if (!username || !email || !password) {
      toast({ title: "入力エラー", description: "すべての項目を入力してください。", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await signup({ email, password, username });
      // Redirect is handled by useEffect after onAuthStateChanged updates context
    } catch (error: any) {
      // Toast is handled by AuthContext
      console.error("Signup page submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authIsLoading && !isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">読み込み中...</p></div>;
  }

  if (isAuthenticated) {
     return <div className="flex justify-center items-center h-full"><p>プロフィール編集へリダイレクト中...</p></div>;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <div className="mx-auto p-3 bg-primary rounded-full w-fit mb-4">
            <UserPlus className="h-10 w-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">アカウント作成</CardTitle>
          <CardDescription>Nukuneに参加して、今日から繋がりを探しましょう。</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground"/>ユーザー名</Label>
              <Input id="username" type="text" placeholder="公開される名前" required value={username} onChange={(e) => setUsername(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>メールアドレス</Label>
              <Input id="email" type="email" placeholder="your@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>パスワード</Label>
              <Input id="password" type="password" placeholder="6文字以上のパスワード" required value={password} onChange={(e) => setPassword(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>パスワード確認</Label>
              <Input id="confirmPassword" type="password" placeholder="パスワードを再入力" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="text-base p-3"/>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-3" disabled={isSubmitting || authIsLoading}>
              {isSubmitting || authIsLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 登録中...
                </>
              ) : (
                '新規登録'
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              すでにアカウントをお持ちですか？{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                ログイン
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
