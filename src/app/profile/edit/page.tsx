
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Image as ImageIcon, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// 現在のユーザーデータのモック構造
interface UserProfileData {
  displayName: string;
  bio: string;
  kinks: string; // この例ではカンマ区切りの文字列で簡略化
  profilePhotoUrl?: string;
}

export default function EditProfilePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [kinks, setKinks] = useState(''); // カンマ区切りの文字列として保存
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 既存のユーザーデータを取得するシミュレーション
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // 実際のアプリではここでユーザーデータを取得します
    const mockUserData: UserProfileData = {
      displayName: 'あおい', // 日本語名に変更
      bio: '人生、冒険、そして新しい繋がりを探求するのが大好きです。オープンマインドで、同じような魂を探しています。', // 日本語に翻訳
      kinks: '旅行,写真,グルメ,深い会話', // 日本語に翻訳
      profilePhotoUrl: 'https://placehold.co/200x200.png?text=あ', // プレースホルダーテキスト変更
    };
    setDisplayName(mockUserData.displayName);
    setBio(mockUserData.bio);
    setKinks(mockUserData.kinks);
    setProfilePhotoPreview(mockUserData.profilePhotoUrl || null);
  }, [isAuthenticated, router]);


  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));

    // フォームデータ送信の処理（例：バックエンドへの送信）
    // profilePhotoFileについては、通常ストレージサービスにアップロードし、
    // URLを保存します。

    console.log({
      displayName,
      bio,
      kinks: kinks.split(',').map(k => k.trim()).filter(k => k), // 配列に変換
      profilePhotoFile: profilePhotoFile?.name, // デモ用にファイル名のみログ出力
    });

    setIsLoading(false);
    toast({
      title: 'プロフィール更新完了',
      description: 'プロフィール情報が正常に保存されました。',
    });
  };

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>ログインページへリダイレクト中...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <UserCircle className="mr-3 h-8 w-8" /> プロフィール編集
          </CardTitle>
          <CardDescription>
            最高のマッチングのために、プロフィールを最新の状態に保ちましょう。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-md bg-secondary">
                {profilePhotoPreview ? (
                  <Image src={profilePhotoPreview} alt="プロフィールプレビュー" layout="fill" objectFit="cover" data-ai-hint="人物 近影" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <Input id="profilePhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-xs file:text-primary file:font-semibold"/>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-base">表示名</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="公開されるユーザー名" required className="text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-base">自己紹介</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="自分自身、興味、探しているものについて教えてください..."
                rows={5}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kinks" className="text-base flex items-center">
                <Tag className="mr-2 h-5 w-5 text-muted-foreground" /> あなたの趣味・興味
              </Label>
              <Input
                id="kinks"
                value={kinks}
                onChange={(e) => setKinks(e.target.value)}
                placeholder="例：旅行, アート, BDSM, ロールプレイ (カンマ区切り)"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">項目はカンマで区切ってください。</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full text-lg py-3">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  保存中...
                </>
              ) : (
                '変更を保存'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
