"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePassword } from '@/lib/password-validation';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [oobCode, setOobCode] = useState('');

  useEffect(() => {
    const code = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    
    if (!code || mode !== 'resetPassword') {
      toast({
        title: 'エラー',
        description: '無効なリンクです。パスワードリセットを再度お試しください。',
        variant: 'destructive'
      });
      router.push('/forgot-password');
      return;
    }
    
    setOobCode(code);
    
    // リセットコードを検証
    if (auth) {
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setEmail(email);
          setIsVerifying(false);
        })
        .catch((error) => {
          console.error('Reset code verification error:', error);
          toast({
            title: 'エラー',
            description: 'リンクが無効または期限切れです。パスワードリセットを再度お試しください。',
            variant: 'destructive'
          });
          router.push('/forgot-password');
        });
    }
  }, [searchParams, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({ 
        title: "入力エラー", 
        description: "すべての項目を入力してください。", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({ 
        title: "パスワードエラー", 
        description: "パスワードが一致しません。", 
        variant: "destructive" 
      });
      return;
    }
    
    // パスワードバリデーション
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast({ 
        title: "パスワードエラー", 
        description: "パスワードが要件を満たしていません。", 
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

      await confirmPasswordReset(auth, oobCode, password);
      
      setIsSuccess(true);
      toast({ 
        title: "成功", 
        description: "パスワードがリセットされました。新しいパスワードでログインしてください。" 
      });
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (error: any) {
      let description = "パスワードのリセットに失敗しました。";
      
      if (error.code === 'auth/expired-action-code') {
        description = "リンクの有効期限が切れています。パスワードリセットを再度お試しください。";
      } else if (error.code === 'auth/invalid-action-code') {
        description = "無効なリンクです。パスワードリセットを再度お試しください。";
      } else if (error.code === 'auth/weak-password') {
        description = "パスワードが弱すぎます。より強力なパスワードを設定してください。";
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

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#F0306A]" />
              <p className="text-gray-600">リンクを確認中...</p>
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
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-bold">パスワードをリセットしました</h2>
              <p className="text-gray-600 text-center">
                新しいパスワードでログインできます。<br />
                ログインページへリダイレクトします...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">新しいパスワードを設定</CardTitle>
          <CardDescription>
            {email} のパスワードをリセットします
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">新しいパスワード</Label>
              <p className="text-xs text-gray-500">8文字以上、大文字・小文字・数字を各1文字以上含む</p>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    const validation = validatePassword(e.target.value);
                    setPasswordErrors(validation.errors);
                  }}
                  required
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <div className={`text-xs ${password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                  {password.length >= 8 ? '✓' : '・'} 8文字以上
                </div>
                <div className={`text-xs ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  {/[A-Z]/.test(password) ? '✓' : '・'} 大文字を1文字以上含む
                </div>
                <div className={`text-xs ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  {/[a-z]/.test(password) ? '✓' : '・'} 小文字を1文字以上含む
                </div>
                <div className={`text-xs ${/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                  {/[0-9]/.test(password) ? '✓' : '・'} 数字を1文字以上含む
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">パスワードが一致しません</p>
              )}
            </div>
          </CardContent>
          <CardContent>
            <Button 
              type="submit" 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              disabled={
                isSubmitting || 
                password.length < 8 ||
                !/[A-Z]/.test(password) ||
                !/[a-z]/.test(password) ||
                !/[0-9]/.test(password) ||
                password !== confirmPassword ||
                !password ||
                !confirmPassword
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  パスワードをリセット中...
                </>
              ) : (
                'パスワードをリセット'
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}