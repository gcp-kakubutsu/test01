
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { LogInIcon, Mail, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // ここで基本的なバリデーションやAPI呼び出しを行います
    if (email && password) {
      login(); // モックログイン
      router.push('/home');
    } else {
      alert("メールアドレスとパスワードを入力してください。");
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 bg-primary rounded-full w-fit mb-4">
            <LogInIcon className="h-10 w-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">おかえりなさい！</CardTitle>
          <CardDescription>ログインしてNukuConnectの旅を続けましょう。</CardDescription>
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
            <Button type="submit" className="w-full text-lg py-3">
              ログイン
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
