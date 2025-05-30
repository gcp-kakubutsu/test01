
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { UserPlus, Mail, KeyRound, UserCircle2 } from 'lucide-react';

export default function SignupPage() {
  const { login } = useAuth(); // 登録成功とログインをシミュレートするためにloginを使用
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // ここで基本的なバリデーションやAPI呼び出しを行います
    if (password !== confirmPassword) {
      alert("パスワードが一致しません。");
      return;
    }
    if (username && email && password) {
      login(); // モックの登録＆ログイン
      router.push('/profile/edit'); // 登録後プロフィール編集へリダイレクト
    } else {
      alert("すべての項目を入力してください。");
    }
  };

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
              <Input id="username" type="text" placeholder="ユーザー名を選択" required value={username} onChange={(e) => setUsername(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>メールアドレス</Label>
              <Input id="email" type="email" placeholder="your@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>パスワード</Label>
              <Input id="password" type="password" placeholder="強力なパスワードを作成" required value={password} onChange={(e) => setPassword(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>パスワード確認</Label>
              <Input id="confirmPassword" type="password" placeholder="パスワードを再入力" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="text-base p-3"/>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-3">
              新規登録
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
