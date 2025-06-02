
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const { signup, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [gender, setGender] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/profile/edit');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!nickname || !email || !password || !birthYear || !birthMonth || !birthDay || !gender) {
      toast({ title: "入力エラー", description: "すべての項目を入力してください。", variant: "destructive" });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({ title: "パスワードエラー", description: "パスワードが一致しません。", variant: "destructive" });
      return;
    }
    
    if (!isOver18) {
      toast({ title: "年齢確認", description: "18歳以上である必要があります。", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const birthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      await signup({ 
        email, 
        password, 
        username: nickname,
        birthDate,
        gender
      });
    } catch (error: any) {
      console.error("Signup page submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 18; // 18歳以上
  const maxYear = currentYear - 100; // 100歳まで
  const years = Array.from({ length: minYear - maxYear + 1 }, (_, i) => minYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  
  if (authIsLoading && !isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">読み込み中...</p></div>;
  }

  if (isAuthenticated) {
     return <div className="flex justify-center items-center h-full"><p>プロフィール編集へリダイレクト中...</p></div>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 bg-[#F9E4EB] min-h-screen">
      <Card className="w-full max-w-md shadow-lg bg-white">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-8 pb-6">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm font-medium">ニックネーム</Label>
              <Input 
                id="nickname" 
                type="text" 
                required 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value)} 
                className="h-12 text-base border-gray-300"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">生年月日</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={birthYear} onValueChange={setBirthYear} required>
                  <SelectTrigger className="h-12 border-gray-300">
                    <SelectValue placeholder="年" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={birthMonth} onValueChange={setBirthMonth} required>
                  <SelectTrigger className="h-12 border-gray-300">
                    <SelectValue placeholder="月" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={birthDay} onValueChange={setBirthDay} required>
                  <SelectTrigger className="h-12 border-gray-300">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map(day => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">メールアドレス</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="h-12 text-base border-gray-300"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">パスワード</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-12 text-base pr-10 border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">パスワード（確認のため再入力してください）</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword" 
                  type={showConfirmPassword ? "text" : "password"}
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="h-12 text-base pr-10 border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">性別</Label>
              <RadioGroup value={gender} onValueChange={setGender} className="space-y-3">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="flex-1 cursor-pointer font-normal">男性</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="flex items-start space-x-3 pt-2">
              <Checkbox 
                id="age-confirmation" 
                checked={isOver18}
                onCheckedChange={(checked) => setIsOver18(checked as boolean)}
                className="mt-1"
              />
              <Label 
                htmlFor="age-confirmation" 
                className="text-sm leading-relaxed cursor-pointer"
              >
                私は18歳以上です。<br />
                <span className="text-xs text-gray-500">（高校生ではありません）</span>
              </Label>
            </div>
          </CardContent>
          
          <CardFooter className="pb-8">
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-medium bg-[#F0306A] hover:bg-[#E02860] text-white rounded-full" 
              disabled={isSubmitting || authIsLoading || !isOver18}
            >
              {isSubmitting || authIsLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 登録中...
                </>
              ) : (
                '新規会員登録する'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          すでにアカウントをお持ちですか？{' '}
          <Link href="/login" className="font-semibold text-[#F0306A] hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
