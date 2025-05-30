
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { aiProfileVerification, type AIProfileVerificationOutput } from '@/ai/flows/ai-profile-verification';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function VerifyProfilePage() {
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AIProfileVerificationOutput | null>(null);
  const { toast } = useToast();

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profilePhotoFile || !profileDescription) {
      toast({
        title: '情報が不足しています',
        description: 'プロフィール写真と説明の両方を提供してください。',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(profilePhotoFile);
      reader.onload = async () => {
        const profilePhotoDataUri = reader.result as string;
        const result = await aiProfileVerification({
          profilePhotoDataUri,
          profileDescription,
        });
        setVerificationResult(result);
        toast({
          title: '認証完了',
          description: 'プロフィール分析が終了しました。',
        });
      };
      reader.onerror = (error) => {
        console.error('ファイル読み取りエラー:', error);
        toast({
          title: 'ファイル読み取りエラー',
          description: 'アップロードされた写真を処理できませんでした。もう一度お試しください。',
          variant: 'destructive',
        });
        setIsLoading(false);
      };
    } catch (error) {
      console.error('認証エラー:', error);
      toast({
        title: '認証失敗',
        description: 'プロフィール認証中にエラーが発生しました。もう一度お試しください。',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  // このeffectは、FileReaderのpromiseがfinallyでキャッチされない場合にローディングが停止することを保証します。
  useEffect(() => {
    if(verificationResult && isLoading) {
        setIsLoading(false);
    }
  }, [verificationResult, isLoading]);


  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">AIプロフィール認証</CardTitle>
          <CardDescription>
            AIによる安全性と信頼性のチェックのために、あなたのプロフィール写真と説明をアップロードしてください。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="profilePhoto" className="text-base">プロフィール写真</Label>
              <Input id="profilePhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="file:text-primary file:font-semibold"/>
              {profilePhotoPreview && (
                <div className="mt-4 relative w-48 h-48 rounded-lg overflow-hidden border-2 border-primary shadow-md mx-auto">
                  <Image src={profilePhotoPreview} alt="プロフィールプレビュー" layout="fill" objectFit="cover" data-ai-hint="人物 確認" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileDescription" className="text-base">プロフィール説明</Label>
              <Textarea
                id="profileDescription"
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="自分自身や探しているものについて教えてください..."
                rows={5}
                className="text-base"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full text-lg py-3">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  認証中...
                </>
              ) : (
                'プロフィールを認証'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {verificationResult && (
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-primary">認証結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center">
              {verificationResult.isGenuine ? (
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500 mr-2" />
              )}
              <p className={`font-semibold ${verificationResult.isGenuine ? 'text-green-600' : 'text-red-600'}`}>
                プロフィールの信頼性: {verificationResult.isGenuine ? '信頼できる可能性が高い' : '信頼できない可能性がある'}
              </p>
            </div>
            <div className="flex items-center">
              {verificationResult.isAppropriate ? (
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-500 mr-2" />
              )}
              <p className={`font-semibold ${verificationResult.isAppropriate ? 'text-green-600' : 'text-yellow-600'}`}>
                コンテンツの適切性: {verificationResult.isAppropriate ? '適切' : '不適切なコンテンツを含む可能性あり'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-muted-foreground">理由:</h4>
              <p className="text-sm">{verificationResult.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
