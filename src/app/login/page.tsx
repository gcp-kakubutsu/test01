
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect } from 'react';
import { LogInIcon, Mail, KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AuthFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      // Check if there's a selected plan in sessionStorage
      const selectedPlan = sessionStorage.getItem('selectedPlan');
      if (selectedPlan) {
        // Clear the stored plan
        sessionStorage.removeItem('selectedPlan');
        // Redirect to subscription page with the plan
        router.push(`/subscription?plan=${selectedPlan}`);
      } else {
        router.push('/home');
      }
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "入力エラー",
        description: "メールアドレスとパスワードを入力してください。",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    const success = await login({ email, password });
    if (success) {
      // Redirect is handled by useEffect
    }
    setIsSubmitting(false);
  };

  if (authIsLoading && !isAuthenticated) { // Show loading only if not yet authenticated
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">読み込み中...</p></div>;
  }

  if (isAuthenticated) { // Prevent flash of login page if already authenticated
     return <div className="flex justify-center items-center h-full"><p>ホームへリダイレクト中...</p></div>;
  }

  return (
    <div className="flex items-center justify-center py-6 sm:py-12 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto p-2 sm:p-3 bg-primary rounded-full w-fit mb-4">
            <LogInIcon className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">おかえりなさい！</CardTitle>
          <CardDescription>ログインしてNukuneの旅を続けましょう。</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>メールアドレス</Label>
              <Input id="email" type="email" placeholder="your@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>パスワード</Label>
              <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* <Checkbox id="remember-me" />
                <Label htmlFor="remember-me" className="text-sm font-normal">ログイン状態を保持</Label> */}
              </div>
              <Link href="#" className="text-sm text-primary hover:underline">
                パスワードをお忘れですか？
              </Link>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-base sm:text-lg py-2.5 sm:py-3" disabled={isSubmitting || authIsLoading}>
              {isSubmitting || authIsLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 送信中...
                </>
              ) : (
                'ログイン'
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              アカウントをお持ちでないですか？{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                新規登録
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
