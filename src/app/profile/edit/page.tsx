
"use client";

import { useState, type FormEvent, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Image as ImageIcon, Tag, X, ArrowLeft, Camera, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { uploadProfileImage, deleteProfileImage } from '@/lib/firebase/storage';
import { useUserProfile } from '@/lib/firebase/hooks';
import { updateUserProfile } from '../actions';
import { ImagePositionAdjuster } from '@/components/ui/image-position-adjuster';
import { getMalePreferences, saveMalePreferences } from '@/lib/firebase/malePreferences';
import { Checkbox } from '@/components/ui/checkbox';


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
  const [additionalPhotos, setAdditionalPhotos] = useState<{file: File | null, preview: string, existing?: boolean}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [showImageAdjuster, setShowImageAdjuster] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [adjustedPhotoBlob, setAdjustedPhotoBlob] = useState<Blob | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalPhotoInputRef = useRef<HTMLInputElement>(null);
  const [girlTypeIds, setGirlTypeIds] = useState<number[]>([]);
  const [girlTypesFromDB, setGirlTypesFromDB] = useState<any[]>([]);
  const [showGirlTypes, setShowGirlTypes] = useState(false);


  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authIsLoading, router]);

  // Fetch girl types from DB
  useEffect(() => {
    const fetchGirlTypes = async () => {
      try {
        const response = await fetch('/api/girl-types');
        const data = await response.json();
        if (data.allTypes) {
          setGirlTypesFromDB(data.allTypes);
        }
      } catch (error) {
        console.error('Failed to fetch girl types:', error);
      }
    };
    fetchGirlTypes();
  }, []);

  // Load existing girl type preferences for male users
  useEffect(() => {
    const loadGirlTypePreferences = async () => {
      // genderが未設定でも男性ユーザーとして扱う（デフォルト）
      if (currentUser) {
        try {
          const preferences = await getMalePreferences(currentUser.uid);
          if (preferences?.girlTypeIds) {
            setGirlTypeIds(preferences.girlTypeIds);
          }
          // 男性ユーザーまたはgender未設定の場合は女の子タイプを表示
          if (profile?.gender === 'male' || !profile?.gender) {
            setShowGirlTypes(true);
          }
        } catch (error) {
          console.error('Failed to load girl type preferences:', error);
        }
      }
    };
    
    if (currentUser && profile) {
      loadGirlTypePreferences();
    }
  }, [currentUser, profile]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setInterests(profile.interests?.join(', ') || '');
      setLocation(profile.location || '');
      setOccupation(profile.occupation || '');
      setProfilePhotoPreview(profile.profilePhotoUrl || null);
      
      // Load additional photos
      if (profile.additionalPhotos && Array.isArray(profile.additionalPhotos)) {
        const existingPhotos = profile.additionalPhotos.map((url: string) => ({
          file: null,
          preview: url,
          existing: true
        }));
        setAdditionalPhotos(existingPhotos);
      }
      
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageUrl(reader.result as string);
        setCurrentPhotoIndex(null); // null means profile photo
        setShowImageAdjuster(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && additionalPhotos.length < 5) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageUrl(reader.result as string);
        setCurrentPhotoIndex(additionalPhotos.length); // Index for new photo
        setShowImageAdjuster(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSave = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(croppedBlob);
    
    if (currentPhotoIndex === null) {
      // Profile photo
      setAdjustedPhotoBlob(croppedBlob);
      setProfilePhotoFile(file);
      setProfilePhotoPreview(url);
    } else {
      // Additional photo
      const newPhotos = [...additionalPhotos];
      newPhotos[currentPhotoIndex] = { file, preview: url, existing: false };
      setAdditionalPhotos(newPhotos);
    }
    
    setShowImageAdjuster(false);
    setTempImageUrl(null);
    setCurrentPhotoIndex(null);
  };

  const handleImageCancel = () => {
    setShowImageAdjuster(false);
    setTempImageUrl(null);
  };

  const handleRemovePhoto = () => {
    setProfilePhotoFile(null);
    setProfilePhotoPreview(null);
    setAdjustedPhotoBlob(null);
    if (profilePhotoPreview && profilePhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(profilePhotoPreview);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAdditionalPhoto = (index: number) => {
    const newPhotos = additionalPhotos.filter((_, i) => i !== index);
    setAdditionalPhotos(newPhotos);
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
      const additionalPhotoUrls: string[] = [];
      
      // 新しいプロフィール画像がアップロードされた場合
      if (profilePhotoFile && adjustedPhotoBlob) {
        console.log('Uploading adjusted photo:', adjustedPhotoBlob, profilePhotoFile);
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
        console.log('New photo URL:', photoUrl);
      }

      // Upload additional photos
      for (let i = 0; i < additionalPhotos.length; i++) {
        const photo = additionalPhotos[i];
        if (photo.existing) {
          // Keep existing photo URL
          additionalPhotoUrls.push(photo.preview);
        } else if (photo.file) {
          // Upload new photo
          const photoType = i === 0 ? 'sub1' : i === 1 ? 'sub2' : 'sub3';
          const uploadedUrl = await uploadProfileImage(currentUser.uid, photo.file, photoType as any);
          additionalPhotoUrls.push(uploadedUrl);
        }
      }

      const updateData = {
        username,
        bio,
        interests: interests.split(',').map(k => k.trim()).filter(k => k),
        location,
        occupation,
        profilePhotoUrl: photoUrl,
        additionalPhotos: additionalPhotoUrls,
      };

      const result = await updateUserProfile(currentUser.uid, updateData);
      
      if (result.success) {
        // 男性ユーザーまたはgender未設定の場合、女の子タイプの設定も保存
        if ((profile?.gender === 'male' || !profile?.gender) && girlTypeIds.length > 0) {
          try {
            const existingPreferences = await getMalePreferences(currentUser.uid);
            await saveMalePreferences(currentUser.uid, {
              ...existingPreferences,
              girlTypeIds: girlTypeIds
            });
          } catch (error) {
            console.error('Failed to save girl type preferences:', error);
          }
        }
        
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
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">プロフィール編集</h1>
      </div>

      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="pb-4">
          <div className="text-center">
            <div className="relative h-40 sm:h-48 md:h-64 lg:h-80 xl:h-96">
              <Image 
                src="/img/pandra.webp" 
                alt="Profile Banner" 
                fill
                className="object-contain"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold mb-2">
              プロフィールを編集
            </CardTitle>
            <CardDescription>
              最高のマッチングのために、プロフィールを最新の状態に保ちましょう。
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Profile Photo Section */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">メイン写真</h3>
              <div className="relative h-[300px] sm:h-[350px] rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg">
                {profilePhotoPreview || profile?.profilePhotoUrl ? (
                  <div className="relative w-full h-full group">
                    <Image 
                      src={profilePhotoPreview || profile?.profilePhotoUrl || ''} 
                      alt="プロフィールプレビュー" 
                      fill
                      className="object-cover w-full h-full"
                      style={{
                        imageRendering: '-webkit-optimize-contrast',
                        filter: 'contrast(1.05) saturate(1.1)',
                      }}
                      sizes="(max-width: 640px) 100vw, 50vw"
                      quality={100}
                      priority
                      unoptimized={profilePhotoPreview?.startsWith('blob:')}
                      data-ai-hint="人物 近影" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Edit Button */}
                    <Button
                      type="button"
                      size="sm"
                      className="absolute top-4 right-4 rounded-full h-10 w-10 p-0 bg-[#F0306A]/90 hover:bg-[#E02860] backdrop-blur-sm shadow-lg"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 text-white" />
                    </Button>
                    
                    {profilePhotoPreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-4 left-4 rounded-full h-10 w-10 p-0 bg-red-500/90 hover:bg-red-600 backdrop-blur-sm shadow-lg"
                        onClick={handleRemovePhoto}
                      >
                        <X className="h-4 w-4 text-white" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-20 h-20 rounded-full bg-[#F0306A]/10 flex items-center justify-center mb-4">
                      <Camera className="h-10 w-10 text-[#F0306A]" />
                    </div>
                    <p className="text-lg font-semibold text-[#F0306A] text-center mb-2">メイン写真をアップロード</p>
                    <p className="text-sm text-gray-500 text-center">あなたの魅力的な写真を選んでください</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} id="profilePhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
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

            {/* Girl Types Section (for male users only) */}
            {showGirlTypes && girlTypesFromDB.length > 0 && (
              <div>
                <Label className="text-base flex items-center mb-3">
                  <Sparkles className="mr-2 h-5 w-5 text-[#F0306A]" /> 
                  希望する女の子タイプ（複数選択可）
                </Label>
                
                {/* 性格タイプ (class_id = 1) */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">性格タイプ</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {girlTypesFromDB.filter((type: any) => type.class_id === 1).map((girlType: any) => (
                      <div 
                        key={girlType.id} 
                        className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          id={`type-${girlType.id}`}
                          checked={girlTypeIds.includes(girlType.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGirlTypeIds([...girlTypeIds, girlType.id]);
                            } else {
                              setGirlTypeIds(girlTypeIds.filter(id => id !== girlType.id));
                            }
                          }}
                          className="data-[state=checked]:bg-[#F0306A] data-[state=checked]:border-[#F0306A]"
                        />
                        <Label htmlFor={`type-${girlType.id}`} className="text-xs font-medium cursor-pointer">
                          {girlType.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 身体タイプ (class_id = 2) */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">身体的特徴</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {girlTypesFromDB.filter((type: any) => type.class_id === 2).map((girlType: any) => (
                      <div 
                        key={girlType.id} 
                        className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          id={`type-${girlType.id}`}
                          checked={girlTypeIds.includes(girlType.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGirlTypeIds([...girlTypeIds, girlType.id]);
                            } else {
                              setGirlTypeIds(girlTypeIds.filter(id => id !== girlType.id));
                            }
                          }}
                          className="data-[state=checked]:bg-[#F0306A] data-[state=checked]:border-[#F0306A]"
                        />
                        <Label htmlFor={`type-${girlType.id}`} className="text-xs font-medium cursor-pointer">
                          {girlType.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* プレイタイプ (class_id = 3) */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">プレイスタイル</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {girlTypesFromDB.filter((type: any) => type.class_id === 3).map((girlType: any) => (
                      <div 
                        key={girlType.id} 
                        className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          id={`type-${girlType.id}`}
                          checked={girlTypeIds.includes(girlType.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGirlTypeIds([...girlTypeIds, girlType.id]);
                            } else {
                              setGirlTypeIds(girlTypeIds.filter(id => id !== girlType.id));
                            }
                          }}
                          className="data-[state=checked]:bg-[#F0306A] data-[state=checked]:border-[#F0306A]"
                        />
                        <Label htmlFor={`type-${girlType.id}`} className="text-xs font-medium cursor-pointer">
                          {girlType.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  選択したタイプに基づいて、最適な女性を検索できます。
                </p>
              </div>
            )}

            {/* Additional Photos Gallery */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">追加写真</h3>
                <Badge variant="secondary" className="bg-[#F0306A]/10 text-[#F0306A]">
                  {additionalPhotos.length}/5枚
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {additionalPhotos.map((photo, index) => (
                  <div key={index} className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="relative w-full aspect-square">
                      <Image
                        src={photo.preview}
                        alt={`Additional photo ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover w-full h-full"
                        style={{
                          imageRendering: '-webkit-optimize-contrast',
                          filter: 'contrast(1.05) saturate(1.1)',
                        }}
                        quality={100}
                        priority={index === 0}
                        unoptimized={photo.preview.startsWith('blob:')}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Photo Index Badge */}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {index + 2}
                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-3 right-3 rounded-full h-8 w-8 p-0 bg-red-500/90 hover:bg-red-600 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        onClick={() => handleRemoveAdditionalPhoto(index)}
                      >
                        <X className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Add Photo Button */}
                {additionalPhotos.length < 5 && (
                  <label className="relative group cursor-pointer">
                    <div className="relative w-full h-0 pb-[120%] sm:pb-[100%] border-2 border-dashed border-[#F0306A]/30 rounded-xl flex items-center justify-center hover:border-[#F0306A]/60 hover:bg-[#F0306A]/5 transition-all duration-300 bg-gradient-to-br from-[#F0306A]/5 to-[#F0306A]/10">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                        <div className="w-16 h-16 rounded-full bg-[#F0306A]/10 flex items-center justify-center mb-3 group-hover:bg-[#F0306A]/20 transition-colors duration-300">
                          <Camera className="h-8 w-8 text-[#F0306A]" />
                        </div>
                        <p className="text-sm font-medium text-[#F0306A] text-center">写真を追加</p>
                        <p className="text-xs text-gray-500 text-center mt-1">最大5枚まで</p>
                      </div>
                    </div>
                    <input
                      ref={additionalPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAdditionalPhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button type="button" variant="outline" onClick={() => router.back()} className="py-3">
                キャンセル
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-[#F0306A] hover:bg-[#E02860] py-3">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '変更を保存'
                )}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      {showImageAdjuster && tempImageUrl && (
        <ImagePositionAdjuster
          imageUrl={tempImageUrl}
          onSave={handleImageSave}
          onCancel={handleImageCancel}
          circular={false} // 全ての写真を四角形で表示
        />
      )}
    </div>
  );
}
