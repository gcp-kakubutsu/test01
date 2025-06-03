"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, MapPin, Heart, X, Navigation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchAdminGirls } from '@/lib/firebase/user-utils';
import { sendLike, recordProfileView } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';
import { getCurrentLocation, sortUsersByDistance, type LocationCoordinates } from '@/lib/utils/location';
import { useUserProfile } from '@/lib/firebase/hooks';

interface UserProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  interests: string[];
  imageUrl: string;
  distance?: number;
}


export default function SearchPage() {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { profile: userProfile } = useUserProfile();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isProcessingLike, setIsProcessingLike] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 位置情報を取得
  useEffect(() => {
    const getLocation = async () => {
      setIsLoadingLocation(true);
      try {
        const locationInfo = await getCurrentLocation();
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates);
          toast({
            title: "位置情報を取得しました",
            description: "近くの女性から優先的に表示します。",
          });
        } else if (locationInfo.error) {
          console.warn('位置情報の取得に失敗:', locationInfo.error);
          // エラーの場合はユーザープロフィールの住所を使用
        }
      } catch (error) {
        console.error('位置情報取得エラー:', error);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    if (isAuthenticated) {
      getLocation();
    }
  }, [isAuthenticated, toast]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      
      try {
        setLoadingUsers(true);
        // 共通関数を使用してFirebaseから管理者登録の女性ユーザーを取得（無制限に近い数を取得）
        const fetchedUsers = await fetchAdminGirls(currentUser.uid, 1000);
        
        // UserProfile型に変換（検索ページ用）
        let searchUsers: UserProfile[] = fetchedUsers.map(user => ({
          id: user.id,
          name: user.name,
          age: user.age,
          location: user.location || '未設定',
          bio: user.bio,
          interests: user.interests || user.kinks || [],
          imageUrl: user.imageUrl
        }));
        
        // 位置情報が取得できている場合は距離順にソート
        if (userLocation) {
          searchUsers = sortUsersByDistance(searchUsers, userLocation);
        } else if (userProfile?.location) {
          // GPS位置情報がない場合はプロフィールの住所を使用
          const { getCoordinatesFromAddress } = await import('@/lib/utils/location');
          const profileCoords = getCoordinatesFromAddress(userProfile.location);
          if (profileCoords) {
            searchUsers = sortUsersByDistance(searchUsers, profileCoords);
          }
        }
        
        // フェッチしたユーザーを設定
        setAllUsers(searchUsers);
        setFilteredUsers(searchUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        setAllUsers([]);
        setFilteredUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isAuthenticated && currentUser) {
      fetchUsers();
    }
  }, [isAuthenticated, currentUser, userLocation, userProfile]);

  // Record profile view when current user changes (with delay to avoid rapid fire)
  useEffect(() => {
    if (currentUser && filteredUsers.length > 0 && currentIndex < filteredUsers.length) {
      const currentProfile = filteredUsers[currentIndex];
      if (currentProfile && currentProfile.id !== currentUser.uid) {
        const timer = setTimeout(() => {
          recordProfileView(currentUser.uid, currentProfile.id);
        }, 200);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, filteredUsers, currentIndex]);

  const handleSearch = () => {
    const filtered = allUsers.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.interests.some(interest => 
        interest.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setFilteredUsers(filtered);
    setCurrentIndex(0);
  };

  const handleLocationSort = async () => {
    setIsLoadingLocation(true);
    try {
      const locationInfo = await getCurrentLocation();
      if (locationInfo.coordinates) {
        setUserLocation(locationInfo.coordinates);
        const sortedUsers = sortUsersByDistance(filteredUsers, locationInfo.coordinates);
        setFilteredUsers(sortedUsers);
        setCurrentIndex(0);
        toast({
          title: "位置情報で並び替えました",
          description: "近い順に表示しています。",
        });
      } else {
        toast({
          title: "位置情報の取得に失敗",
          description: locationInfo.error || "位置情報を取得できませんでした。",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "位置情報の取得中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleLike = async () => {
    if (isProcessingLike || !currentUser) return;
    
    const targetUser = filteredUsers[currentIndex];
    if (!targetUser) return;
    
    setIsProcessingLike(true);
    
    try {
      const result = await sendLike(currentUser.uid, targetUser.id);
      
      if (result.isMatch) {
        toast({
          title: "マッチしました！🎉",
          description: `${targetUser.name}さんとマッチしました！メッセージを送ってみましょう。`,
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
          description: `${targetUser.name}さんにいいねを送りました。`,
        });
      }
      
      nextProfile();
      setIsProcessingLike(false);
      
    } catch (error) {
      console.error('Error sending like:', error);
      toast({
        title: "エラー",
        description: "いいねの送信に失敗しました。",
        variant: "destructive",
      });
      setIsProcessingLike(false);
    }
  };

  const handlePass = () => {
    console.log('Passed:', filteredUsers[currentIndex]);
    nextProfile();
  };

  const nextProfile = () => {
    // 最後のプロフィールの場合は最初に戻る（無限ループ）
    setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredUsers.length);
  };

  if (isLoading || loadingUsers || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  const currentProfile = filteredUsers[currentIndex];

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="名前、趣味、場所で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">
          <Filter className="h-4 w-4" />
        </Button>
        <Button 
          onClick={handleLocationSort} 
          variant="outline"
          disabled={isLoadingLocation}
          title="位置情報で並び替え"
        >
          {isLoadingLocation ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Cards */}
      {currentProfile ? (
        <Card className="overflow-hidden shadow-lg">
          <div className="relative h-[500px]">
            <Image
              src={currentProfile.imageUrl}
              alt={currentProfile.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            
            {/* User Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{currentProfile.name}</h2>
                  <span className="text-xl">{currentProfile.age}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 mb-3 text-sm">
                <MapPin className="h-4 w-4" />
                <span>{currentProfile.location}</span>
                {currentProfile.distance !== undefined && currentProfile.distance !== Infinity && (
                  <span className="ml-2 px-2 py-1 bg-black/30 rounded-full text-xs">
                    約{Math.round(currentProfile.distance)}km
                  </span>
                )}
              </div>
              
              <p className="mb-3 text-sm">{currentProfile.bio}</p>
              
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="bg-white/20 text-white border-white/30">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <CardContent className="p-4">
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full h-16 w-16 p-0 border-2 hover:border-red-500 hover:bg-red-50"
                onClick={handlePass}
              >
                <X className="h-8 w-8 text-red-500" />
              </Button>
              <Button
                size="lg"
                className="rounded-full h-16 w-16 p-0 bg-[#F0306A] hover:bg-[#E02860]"
                onClick={handleLike}
                disabled={isProcessingLike}
              >
                <Heart className="h-8 w-8 text-white" fill="white" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-500">検索結果がありません</p>
        </Card>
      )}

      {/* Results Counter */}
      {filteredUsers.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          {currentIndex + 1} / {filteredUsers.length} 人
        </p>
      )}
    </div>
  );
}