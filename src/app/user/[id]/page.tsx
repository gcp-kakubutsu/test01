"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft,
  MapPin, 
  Briefcase, 
  Heart, 
  Users, 
  MessageCircle,
  Shield,
  Loader2,
  Ban
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUserProfile, useUserStats } from '@/lib/firebase/hooks';
import { calculateAge } from '@/lib/utils/date';
import { sendLike, recordProfileView } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isProcessingLike, setIsProcessingLike] = useState(false);

  // Unwrap params
  useEffect(() => {
    params.then(p => setUserId(p.id));
  }, [params]);

  const { profile, loading: profileLoading, error } = useUserProfile(userId || undefined);
  // Don't fetch stats for other users due to permission restrictions
  // const { stats, loading: statsLoading } = useUserStats(userId || undefined);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Don't allow viewing own profile this way
  useEffect(() => {
    if (currentUser && userId && userId === currentUser.uid) {
      router.push('/profile');
    }
  }, [currentUser, userId, router]);

  // Record profile view when page loads
  useEffect(() => {
    if (currentUser && userId && currentUser.uid !== userId) {
      recordProfileView(currentUser.uid, userId);
    }
  }, [currentUser, userId]);

  useEffect(() => {
    if (profile) {
      // Set photos array (profile photo + additional photos)
      const allPhotos = [];
      if (profile.profilePhotoUrl) allPhotos.push(profile.profilePhotoUrl);
      if (profile.additionalPhotos && Array.isArray(profile.additionalPhotos)) {
        allPhotos.push(...profile.additionalPhotos);
      }
      setPhotos(allPhotos);
    }
  }, [profile]);

  const handleLike = async () => {
    if (!currentUser || !userId || isProcessingLike) return;
    
    setIsProcessingLike(true);
    try {
      const result = await sendLike(currentUser.uid, userId);
      
      if (result.alreadyLiked) {
        toast({
          title: "既にいいねを送っています",
          description: `${profile?.username}さんには既にいいねを送信済みです。`,
        });
      } else if (result.isMatch) {
        toast({
          title: "マッチしました！🎉",
          description: `${profile?.username}さんとマッチしました！メッセージを送ってみましょう。`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/messages/${result.matchId}`)}
            >
              メッセージを送る
            </Button>
          ),
        });
      } else {
        toast({
          title: "いいねを送りました！",
          description: `${profile?.username}さんにいいねを送りました。`,
        });
      }
    } catch (error) {
      console.error('Error sending like:', error);
      toast({
        title: "エラー",
        description: "いいねの送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsProcessingLike(false);
    }
  };

  const handleBlock = () => {
    // Placeholder for block functionality
    toast({
      title: "ブロック機能",
      description: "この機能は近日実装予定です。",
    });
  };

  if (authLoading || profileLoading || !userId) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">プロフィール</h1>
        </div>
        <Card className="p-8 text-center">
          <p className="text-gray-500">プロフィールが見つかりません</p>
        </Card>
      </div>
    );
  }

  // Don't render if viewing own profile (will be redirected by useEffect)
  if (currentUser && userId && userId === currentUser.uid) {
    return null;
  }

  const age = profile.birthDate ? calculateAge(profile.birthDate) : null;
  const displayName = profile.username || 'ユーザー';
  const location = profile.location || '未設定';
  const occupation = profile.occupation || '未設定';
  const bio = profile.bio || 'まだ自己紹介がありません';
  const interests = profile.interests || [];
  const profilePhoto = profile.profilePhotoUrl || 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">プロフィール</h1>
      </div>

      {/* Profile Header */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={profilePhoto}
                  alt="Profile"
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {age && <span className="text-lg text-gray-600">{age}歳</span>}
                {profile.accountStatus === 'verified' && (
                  <Badge className="bg-blue-500">
                    <Shield className="h-3 w-3 mr-1" />
                    認証済み
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {occupation}
                </span>
              </div>
              
              {profile.gender && (
                <div className="mt-1">
                  <Badge variant="outline">
                    {profile.gender === 'male' ? '男性' : 
                     profile.gender === 'female' ? '女性' : 'その他'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Stats - Hidden for other users due to privacy */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Heart className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">-</p>
              <p className="text-xs text-gray-600">いいね</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Users className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">-</p>
              <p className="text-xs text-gray-600">マッチ</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <MessageCircle className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">-</p>
              <p className="text-xs text-gray-600">閲覧数</p>
            </div>
          </div>
          
          {/* Bio */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">自己紹介</h3>
            <p className="text-gray-700">{bio}</p>
          </div>
          
          {/* Interests */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">興味・趣味</h3>
            <div className="flex flex-wrap gap-2">
              {interests.length > 0 ? (
                interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-gray-500">設定されていません</p>
              )}
            </div>
          </div>
          
          {/* Photos */}
          <div>
            <h3 className="font-semibold mb-2">写真</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <div className="relative w-full h-0 pb-[100%] overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <div className="col-span-2 sm:col-span-3 text-center py-8 text-gray-500">
                  <p>写真がありません</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="w-full border-red-500 text-red-500 hover:bg-red-50"
          onClick={handleBlock}
        >
          <Ban className="h-4 w-4 mr-2" />
          ブロック
        </Button>
        <Button
          className="w-full bg-[#F0306A] hover:bg-[#E02860]"
          onClick={handleLike}
          disabled={isProcessingLike}
        >
          {isProcessingLike ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              送信中...
            </>
          ) : (
            <>
              <Heart className="h-4 w-4 mr-2" />
              いいね
            </>
          )}
        </Button>
      </div>
    </div>
  );
}