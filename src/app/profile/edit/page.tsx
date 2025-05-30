
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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";


interface UserProfileData {
  displayName: string;
  bio: string;
  kinks: string; // カンマ区切りの文字列として保存
  profilePhotoUrl?: string;
}

export default function EditProfilePage() {
  const { currentUser, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [kinks, setKinks] = useState('');
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
    const fetchUserData = async () => {
      if (currentUser) {
        setIsFetchingData(true);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserProfileData;
            setDisplayName(userData.displayName || currentUser.displayName || '');
            setBio(userData.bio || '');
            setKinks(Array.isArray(userData.kinks) ? userData.kinks.join(', ') : (userData.kinks || ''));
            setProfilePhotoPreview(userData.profilePhotoUrl || currentUser.photoURL || null);
          } else {
            // If no doc, use auth display name or empty
             setDisplayName(currentUser.displayName || '');
             setProfilePhotoPreview(currentUser.photoURL || null);
             toast({ title: "プロフィール情報が見つかりません", description: "新しいプロフィールを作成してください。", variant: "default" });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast({ title: "データ取得エラー", description: "プロフィール情報の取得に失敗しました。", variant: "destructive" });
        } finally {
          setIsFetchingData(false);
        }
      } else if (!authIsLoading) {
        // If no current user and not loading auth state, means user is not logged in or data is not yet available
        setIsFetchingData(false);
      }
    };

    if (!authIsLoading && isAuthenticated) {
      fetchUserData();
    }
  }, [currentUser, authIsLoading, isAuthenticated, toast]);


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
      let photoUrl = profilePhotoPreview || '';
      if (profilePhotoFile) {
        const storage = getStorage();
        const photoRef = ref(storage, `profilePhotos/${currentUser.uid}/${profilePhotoFile.name}`);
        const snapshot = await uploadBytes(photoRef, profilePhotoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        displayName,
        bio,
        kinks: kinks.split(',').map(k => k.trim()).filter(k => k),
        profilePhotoUrl: photoUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true }); // Use merge to avoid overwriting fields like createdAt

      setIsLoading(false);
      toast({
        title: 'プロフィール更新完了',
        description: 'プロフィール情報が正常に保存されました。',
      });
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
