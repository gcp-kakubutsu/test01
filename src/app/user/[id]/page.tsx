"use client";

import { useState, useEffect, useCallback } from 'react';
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
  Ban,
  Camera
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUserProfile, useUserStats } from '@/lib/firebase/hooks';
import { calculateAge } from '@/lib/utils/date';
import { sendLike, recordProfileView } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isProcessingLike, setIsProcessingLike] = useState(false);

  // Unwrap params
  useEffect(() => {
    params.then(p => setUserId(p.id));
  }, [params]);

  const { profile, loading: profileLoading, error } = useUserProfile(userId || undefined);
  // Fetch only profile views for other users
  const [profileViews, setProfileViews] = useState(0);
  const [loadingViews, setLoadingViews] = useState(true);

  const fetchProfileViewsCount = useCallback(async () => {
    if (!userId) return;
    
    setLoadingViews(true);
    try {
      const { collection, query, where, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/client');
      
      if (!db) throw new Error('Firestore is not initialized');
      const viewsRef = collection(db, 'profileViews');
      const viewsQuery = query(viewsRef, where('viewedUserId', '==', userId));
      
      // Use onSnapshot for real-time updates
      const unsubscribe = onSnapshot(viewsQuery, (snapshot) => {
        setProfileViews(snapshot.size);
        setLoadingViews(false);
      }, (error) => {
        // Handle permission errors gracefully
        const firebaseError = error as any;
        if (firebaseError.code === 'permission-denied' && !currentUser) {
          // User logged out, this is expected
          setProfileViews(0);
          setLoadingViews(false);
          return;
        }
        console.error('Error fetching profile views:', error);
        setProfileViews(0);
        setLoadingViews(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up profile views listener:', error);
      setProfileViews(0);
      setLoadingViews(false);
    }
  }, [userId]);

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

  // Record profile view when page loads (with slight delay to avoid duplicate records)
  // Only record if user is premium
  useEffect(() => {
    const recordView = async () => {
      if (currentUser && userId && currentUser.uid !== userId && isPremium) {
        // Small delay to ensure page is fully loaded
        setTimeout(async () => {
          await recordProfileView(currentUser.uid, userId);
          // Real-time listener will automatically update the count
        }, 100);
      }
    };
    recordView();
  }, [currentUser, userId, isPremium]);

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

  // Set up real-time profile views listener
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      unsubscribe = await fetchProfileViewsCount();
    };

    if (userId) {
      setupListener();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchProfileViewsCount, userId]);

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

  if (authLoading || profileLoading || subscriptionLoading || !userId) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check if user is premium - if not, show restriction message
  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">プロフィール</h1>
        </div>
        <Card className="p-8 text-center">
          <div className="mb-4">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">有料会員限定</h2>
            <p className="text-gray-500 mb-4">プロフィールの詳細は有料会員のみ閲覧できます</p>
          </div>
          <Button
            className="bg-[#F0306A] hover:bg-[#E02860]"
            onClick={() => router.push('/subscription')}
          >
            有料プランを見る
          </Button>
        </Card>
      </div>
    );
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
    <div className="max-w-2xl mx-auto space-y-6 pb-20 bg-white dark:bg-black" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">プロフィール</h1>
      </div>

      {/* Large Profile Header - Instagram style */}
      <Card className="overflow-hidden shadow-lg">
        <div className="relative h-[400px] sm:h-[450px] md:h-[500px] bg-gray-100">
          <Image
            src={profilePhoto}
            alt="Profile"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            quality={100}
            priority
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          
          {/* User Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 !text-white" style={{ color: '#FFFFFF' }}>
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold !text-white" style={{ color: '#FFFFFF' }}>{displayName}</h1>
                {age && <span className="text-xl sm:text-2xl !text-white" style={{ color: '#FFFFFF' }}>{age}歳</span>}
              </div>
              
              <div className="flex items-center gap-4 text-sm mb-2">
                <span className="flex items-center gap-1 !text-white" style={{ color: '#FFFFFF' }}>
                  <MapPin className="h-4 w-4" />
                  {location}
                </span>
                <span className="flex items-center gap-1 !text-white" style={{ color: '#FFFFFF' }}>
                  <Briefcase className="h-4 w-4" />
                  {occupation}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {profile.accountStatus === 'verified' && (
                  <Badge className="bg-blue-500/80 backdrop-blur-sm">
                    <Shield className="h-3 w-3 mr-1" />
                    認証済み
                  </Badge>
                )}
                {profile.gender && (
                  <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                    {profile.gender === 'male' ? '男性' : 
                     profile.gender === 'female' ? '女性' : 'その他'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <CardContent className="bg-white">
          {/* Stats - Only profile views are shown for other users */}
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
              <p className="text-2xl font-bold">
                {loadingViews ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  profileViews
                )}
              </p>
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
          
          {/* Additional Photos Gallery */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">フォトギャラリー</h3>
              {photos.length > 1 && (
                <Badge variant="secondary" className="bg-[#F0306A]/10 text-[#F0306A]">
                  {photos.length - 1}枚の写真
                </Badge>
              )}
            </div>
            
            {photos.length > 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {photos.slice(1).map((photo, index) => (
                  <div key={index + 1} className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div className="relative w-full aspect-square">
                      <Image
                        src={photo}
                        alt={`Photo ${index + 2}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                        quality={100}
                        priority={index === 0}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      
                      {/* Photo Index Badge */}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {index + 2}
                      </div>
                      
                      {/* View Full Size Hint */}
                      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        拡大表示
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                  <Camera className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">追加の写真がありません</p>
                <p className="text-sm text-gray-400 mt-1">プロフィール写真のみ表示中</p>
              </div>
            )}
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