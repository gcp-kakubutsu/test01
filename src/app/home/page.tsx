
"use client";

import { UserProfileCard } from '@/components/home/UserProfileCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Ban, ChevronLeft, ChevronRight, Heart, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchAdminGirls, shuffleUsers, type UserProfile } from '@/lib/firebase/user-utils';
import { sendLike, recordProfileView } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';
import { getCurrentLocation, sortUsersByDistance, type LocationCoordinates } from '@/lib/utils/location';
import { useUserProfile } from '@/lib/firebase/hooks';

export default function HomePage() {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { profile: userProfile } = useUserProfile();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [feedback, setFeedback] = useState<'liked' | 'passed' | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isProcessingLike, setIsProcessingLike] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 位置情報を取得
  useEffect(() => {
    const getLocation = async () => {
      try {
        const locationInfo = await getCurrentLocation();
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates);
        }
      } catch (error) {
        console.error('位置情報取得エラー:', error);
      }
    };

    if (isAuthenticated) {
      getLocation();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      
      try {
        setLoadingUsers(true);
        // 共通関数を使用してFirebaseから管理者登録の女性ユーザーを取得（より多く取得）
        let fetchedUsers = await fetchAdminGirls(currentUser.uid, 100);
        
        // 位置情報が取得できている場合は距離順にソート
        if (userLocation) {
          fetchedUsers = sortUsersByDistance(fetchedUsers, userLocation);
        } else if (userProfile?.location) {
          // GPS位置情報がない場合はプロフィールの住所を使用
          const { getCoordinatesFromAddress } = await import('@/lib/utils/location');
          const profileCoords = getCoordinatesFromAddress(userProfile.location);
          if (profileCoords) {
            fetchedUsers = sortUsersByDistance(fetchedUsers, profileCoords);
          }
        }
        
        // Firebaseから取得したデータを設定
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]); // エラー時は空配列
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isAuthenticated && currentUser) {
      fetchUsers();
    }
  }, [isAuthenticated, currentUser, userLocation, userProfile]);

  // Record profile view when user changes (with delay to avoid rapid fire)
  useEffect(() => {
    if (currentUser && users.length > 0 && currentUserIndex < users.length) {
      const currentProfile = users[currentUserIndex];
      if (currentProfile && currentProfile.id !== currentUser.uid) {
        const timer = setTimeout(() => {
          recordProfileView(currentUser.uid, currentProfile.id);
        }, 200);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, users, currentUserIndex]);

  const handleAction = (action: 'like' | 'pass') => {
    setFeedback(action === 'like' ? 'liked' : 'passed');
    setTimeout(() => {
      setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length);
      setFeedback(null);
    }, 500); // フィードバックアニメーションの時間
  };

  const handleLike = async () => {
    if (isProcessingLike || !currentUser) return;
    
    const targetUser = users[currentUserIndex];
    if (!targetUser) return;
    
    setIsProcessingLike(true);
    setFeedback('liked');
    
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
      }
      
      // Move to next profile after animation
      setTimeout(() => {
        setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length);
        setFeedback(null);
        setIsProcessingLike(false);
      }, 500);
      
    } catch (error) {
      console.error('Error sending like:', error);
      toast({
        title: "エラー",
        description: "いいねの送信に失敗しました。",
        variant: "destructive",
      });
      setFeedback(null);
      setIsProcessingLike(false);
    }
  };
  const handlePass = () => handleAction('pass');
  const handlePrevious = () => {
     setCurrentUserIndex((prevIndex) => (prevIndex - 1 + users.length) % users.length);
  };
  const handleReset = async () => {
    setCurrentUserIndex(0); // 最初のユーザーにリセット
    // Firebase から再度データを取得
    if (!currentUser) return;
    
    try {
      setLoadingUsers(true);
      // 共通関数を使用してFirebaseから管理者登録の女性ユーザーを取得
      let fetchedUsers = await fetchAdminGirls(currentUser.uid, 100);
      
      // 位置情報が取得できている場合は距離順にソート、そうでなければシャッフル
      if (userLocation) {
        fetchedUsers = sortUsersByDistance(fetchedUsers, userLocation);
      } else if (userProfile?.location) {
        // GPS位置情報がない場合はプロフィールの住所を使用
        const { getCoordinatesFromAddress } = await import('@/lib/utils/location');
        const profileCoords = getCoordinatesFromAddress(userProfile.location);
        if (profileCoords) {
          fetchedUsers = sortUsersByDistance(fetchedUsers, profileCoords);
        } else {
          fetchedUsers = shuffleUsers(fetchedUsers);
        }
      } else {
        fetchedUsers = shuffleUsers(fetchedUsers);
      }
      
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // エラー時は空配列
    } finally {
      setLoadingUsers(false);
    }
  }

  if (isLoading || loadingUsers) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or during transition:
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  if (users.length === 0) {
    return <div className="text-center py-10">現在表示できるプロフィールはありません。後でもう一度確認してください！</div>;
  }

  const currentProfile = users[currentUserIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-sm relative">
        {currentProfile ? (
          <UserProfileCard user={currentProfile} feedback={feedback} />
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-xl mb-4">現在表示できるプロフィールはありません！</p>
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" /> プロフィールを再読み込み
            </Button>
          </div>
        )}
      </div>
      {currentProfile && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={handlePrevious} aria-label="前へ">
            <ChevronLeft className="h-8 w-8 text-muted-foreground" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4 h-20 w-20 shadow-xl hover:bg-destructive/90" onClick={handlePass} aria-label="スキップ">
            <Ban className="h-10 w-10" />
          </Button>
          <Button 
            variant="default" 
            size="lg" 
            className="rounded-full p-4 h-20 w-20 bg-green-500 hover:bg-green-600 shadow-xl" 
            onClick={handleLike} 
            aria-label="いいね"
            disabled={isProcessingLike}
          >
            <Heart className="h-10 w-10" />
          </Button>
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={() => setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length)} aria-label="次へ">
            <ChevronRight className="h-8 w-8 text-muted-foreground" />
          </Button>
        </div>
      )}
       <Button onClick={handleReset} variant="outline" className="mt-6">
          <RotateCcw className="mr-2 h-4 w-4" /> スワイプをリセット
       </Button>
    </div>
  );
}
