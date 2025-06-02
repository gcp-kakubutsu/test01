
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
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { uploadProfileImage, deleteProfileImage } from '@/lib/firebase/storage';
import { useUserProfile } from '@/lib/firebase/hooks';
import { updateUserProfile } from '../actions';


interface UserProfileData {
  username: string;
  bio: string;
  interests: string[]; 
  profilePhotoUrl?: string;
  location?: string;
  occupation?: string;
}

export default function EditProfilePage() {
  const { currentUser, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [location, setLocation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);


  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authIsLoading, router]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setInterests(profile.interests?.join(', ') || '');
      setLocation(profile.location || '');
      setOccupation(profile.occupation || '');
      setProfilePhotoPreview(profile.profilePhotoUrl || null);
      setIsFetchingData(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!authIsLoading && !profile && currentUser) {
      setIsFetchingData(false);
    } else if (!authIsLoading && !currentUser) {
      setIsFetchingData(false);
    }
  }, [currentUser, authIsLoading, profile]);


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
    if (!currentUser) {
      toast({ title: "エラー", description: "ユーザー情報がありません。", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      let photoUrl = profile?.profilePhotoUrl || '';
      
      // 新しい画像がアップロードされた場合
      if (profilePhotoFile) {
        // 既存の画像がある場合は削除
        if (profile?.profilePhotoUrl) {
          try {
            await deleteProfileImage(profile.profilePhotoUrl);
          } catch (error) {
            console.error('既存画像の削除エラー:', error);
          }
        }
        
        // 新しい画像をアップロード
        photoUrl = await uploadProfileImage(currentUser.uid, profilePhotoFile, 'main');
      }

      const updateData = {
        username,
        bio,
        interests: interests.split(',').map(k => k.trim()).filter(k => k),
        location,
        occupation,
        profilePhotoUrl: photoUrl,
      };

      const result = await updateUserProfile(currentUser.uid, updateData);
      
      if (result.success) {
        setIsLoading(false);
        toast({
          title: 'プロフィール更新完了',
          description: 'プロフィール情報が正常に保存されました。',
        });
        router.push('/profile');
      } else {
        throw new Error(result.error || '更新に失敗しました');
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setIsLoading(false);
      toast({
        title: '更新エラー',
        description: error.message || 'プロフィールの更新に失敗しました。',
        variant: 'destructive',
      });
    }
  };

  if (authIsLoading || isFetchingData) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }

  if (!isAuthenticated) {
     return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
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
              <Label htmlFor="username" className="text-base">ユーザー名</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="公開される名前" required className="text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-base">居住地</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: 東京都" className="text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation" className="text-base">職業</Label>
              <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="例: デザイナー" className="text-base" />
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
              <Label htmlFor="interests" className="text-base flex items-center">
                <Tag className="mr-2 h-5 w-5 text-muted-foreground" /> あなたの趣味・興味
              </Label>
              <Input
                id="interests"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="例：カフェ, 映画, 旅行, アート (カンマ区切り)"
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
