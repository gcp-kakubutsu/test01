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
import { useSubscription } from '@/hooks/useSubscription';
import styles from './search.module.scss';
import '@/styles/blur.css';

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
  const { isPremium, loading: subscriptionLoading } = useSubscription();
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
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 位置情報を取得
  const requestLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError(null); // Clear any existing errors
    try {
      const locationInfo = await getCurrentLocation();
      if (locationInfo.coordinates) {
        setUserLocation(locationInfo.coordinates);
        toast({
          title: "位置情報を取得しました",
          description: "近くの女性から優先的に表示します。",
        });
        
        // 位置情報が取得できたら、ユーザーリストを再ソート
        if (allUsers.length > 0) {
          const sortedUsers = sortUsersByDistance(allUsers, locationInfo.coordinates);
          setFilteredUsers(sortedUsers);
        }
      } else if (locationInfo.error) {
        console.warn('位置情報の取得に失敗:', locationInfo.error);
        // Don't show toast here, only set error state
        setLocationError(locationInfo.error);
      }
    } catch (error) {
      console.error('位置情報取得エラー:', error);
      setLocationError("位置情報の取得中にエラーが発生しました。");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !userLocation) {
      requestLocation();
    }
  }, [isAuthenticated]);

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
    // 既に位置情報がある場合は、そのまま並び替え
    if (userLocation && filteredUsers.length > 0) {
      const sortedUsers = sortUsersByDistance(filteredUsers, userLocation);
      setFilteredUsers(sortedUsers);
      setCurrentIndex(0);
      toast({
        title: "位置情報で並び替えました",
        description: "近い順に表示しています。",
      });
      return;
    }

    // 位置情報がない場合は取得
    setIsLoadingLocation(true);
    setLocationError(null);
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
        const errorMsg = locationInfo.error || "位置情報を取得できませんでした。";
        setLocationError(errorMsg);
        // Don't show toast when we're already showing error message
      }
    } catch (error) {
      console.error('位置情報取得エラー:', error);
      const errorMsg = "位置情報の取得中にエラーが発生しました。";
      setLocationError(errorMsg);
      // Don't show toast when we're already showing error message
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleLike = async () => {
    if (isProcessingLike || !currentUser) return;
    
    // Premium check
    if (!isPremium) {
      toast({
        title: "有料会員限定",
        description: "有料会員にならないといいねは出来ません。",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/subscription')}
          >
            有料会員になる
          </Button>
        ),
      });
      return;
    }
    
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

  if (isLoading || loadingUsers || subscriptionLoading || !isAuthenticated) {
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
    <div className={styles.searchContainer}>
      {/* Location Error Message */}
      {locationError && (
        <div 
          className={styles.errorMessage}
          onClick={() => setLocationError(null)}
          role="alert"
          aria-live="assertive"
        >
          <div style={{ marginBottom: '0.25rem' }}>
            {locationError}
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
            (タップして閉じる)
          </div>
        </div>
      )}
      
      {/* Search Bar */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <Input
              type="text"
              placeholder="名前、趣味、場所で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className={styles.searchInput}
            />
          </div>
          <Button onClick={handleSearch} className={styles.filterButton}>
            <Filter className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleLocationSort} 
            className={styles.locationButton}
            disabled={isLoadingLocation}
            title={userLocation ? "位置情報で再度並び替え" : "位置情報を取得して並び替え"}
          >
            {isLoadingLocation ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            ) : (
              <Navigation className={`h-4 w-4 ${userLocation ? 'text-green-600' : ''}`} />
            )}
          </Button>
        </div>
        
        {/* 位置情報のステータス表示 */}
        {userLocation && (
          <div className={styles.locationStatus}>
            <MapPin className="h-3 w-3" />
            位置情報を使用して表示中
          </div>
        )}
      </div>

      {/* User Cards */}
      {currentProfile ? (
        <div className={styles.profileCard}>
          <div className={`${styles.profileImageContainer} ${!isPremium ? 'blur-overlay' : ''}`}>
            <Image
              src={currentProfile.imageUrl}
              alt={currentProfile.name}
              fill
              className={`object-cover ${!isPremium ? 'blur-image' : ''}`}
            />
            <div className={styles.profileGradient} />
            
            {/* User Info Overlay */}
            <div className={styles.profileInfo}>
              <div className={styles.profileHeader}>
                <div className={styles.profileName}>
                  <h2>{currentProfile.name}</h2>
                  <span>{currentProfile.age}歳</span>
                </div>
              </div>
              
              <div className={styles.profileLocation}>
                <MapPin className="h-4 w-4" style={{ color: '#FFFFFF' }} />
                <span style={{ color: '#FFFFFF' }}>{currentProfile.location}</span>
                {currentProfile.distance !== undefined && currentProfile.distance !== Infinity && (
                  <span className={styles.distanceBadge} style={{ color: '#FFFFFF' }}>
                    約{Math.round(currentProfile.distance)}km
                  </span>
                )}
              </div>
              
              <p className={`${styles.profileBio} ${!isPremium ? 'blur-content' : ''}`}>{currentProfile.bio}</p>
              
              <div className={`${styles.profileInterests} ${!isPremium ? 'blur-content' : ''}`}>
                {currentProfile.interests.map((interest) => (
                  <span key={interest} className={styles.interestBadge}>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <div className={styles.buttonContainer}>
              <button
                className={`${styles.actionButton} ${styles.passButton}`}
                onClick={handlePass}
              >
                <X />
              </button>
              <button
                className={`${styles.actionButton} ${styles.likeButton}`}
                onClick={handleLike}
                disabled={isProcessingLike}
              >
                <Heart fill="white" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.profileCard}>
          <div className="p-8 text-center">
            <p className="text-gray-400">検索結果がありません</p>
          </div>
        </div>
      )}

      {/* Results Counter */}
      {filteredUsers.length > 0 && (
        <p className="text-center text-sm text-gray-400 mt-4">
          {currentIndex + 1} / {filteredUsers.length} 人
        </p>
      )}
    </div>
  );
}