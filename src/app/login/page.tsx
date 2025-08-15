
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect } from 'react';
import { LogInIcon, Mail, KeyRound, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { isLineApp, isSessionStorageAvailable } from '@/lib/utils/browser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  useEffect(() => {
    if (isAuthenticated) {
      // Check if there's a selected plan in sessionStorage
      if (isSessionStorageAvailable()) {
        const selectedPlan = sessionStorage.getItem('selectedPlan');
        if (selectedPlan) {
          // Clear the stored plan
          sessionStorage.removeItem('selectedPlan');
          // Redirect to subscription page with the plan
          router.push(`/subscription?plan=${selectedPlan}`);
        } else {
          router.push('/home');
        }
      } else {
        // If sessionStorage is not available, just redirect to home
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
    <div className="flex flex-col items-center justify-center py-6 sm:py-12 px-4">
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4">
            <Logo width={150} height={50} />
          </div>
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
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
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
