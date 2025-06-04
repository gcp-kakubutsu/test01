
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
import { sortUsersByPreference } from '@/lib/utils/userSorting';
import { useUserProfile } from '@/lib/firebase/hooks';
import WelcomePage from '@/components/WelcomePage';
import MaleOnboarding from '@/components/MaleOnboarding';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getMalePreferences, isMalePreferencesComplete } from '@/lib/firebase/malePreferences';

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
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingWelcome, setCheckingWelcome] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check if user should see welcome page or onboarding (male users)
  useEffect(() => {
    const checkWelcomeStatus = async () => {
      if (!currentUser || !userProfile || !db) {
        setCheckingWelcome(false);
        return;
      }

      // Only check for male users
      if (userProfile.gender !== 'male') {
        setCheckingWelcome(false);
        return;
      }

      try {
        // Check if user has seen welcome
        const welcomeRef = doc(db, 'userSettings', currentUser.uid);
        const welcomeDoc = await getDoc(welcomeRef);
        const hasSeenWelcome = welcomeDoc.exists() && welcomeDoc.data()?.hasSeenWelcome;

        // Check if user has completed detailed preferences
        const malePreferences = await getMalePreferences(currentUser.uid);
        const hasCompletedPreferences = isMalePreferencesComplete(malePreferences);

        if (!hasSeenWelcome) {
          // First time - show welcome page
          setShowWelcome(true);
        } else if (!hasCompletedPreferences) {
          // Has seen welcome but not completed preferences - show onboarding
          setShowOnboarding(true);
        }
        // If both are complete, show normal home page
      } catch (error) {
        console.error('Error checking welcome status:', error);
      } finally {
        setCheckingWelcome(false);
      }
    };

    if (isAuthenticated && currentUser && userProfile) {
      checkWelcomeStatus();
    }
  }, [isAuthenticated, currentUser, userProfile]);

  // Handle welcome completion
  const handleWelcomeComplete = async () => {
    if (!currentUser || !db) return;

    try {
      const welcomeRef = doc(db, 'userSettings', currentUser.uid);
      await setDoc(welcomeRef, { hasSeenWelcome: true }, { merge: true });
      setShowWelcome(false);
      // After welcome, check if onboarding is needed
      const malePreferences = await getMalePreferences(currentUser.uid);
      const hasCompletedPreferences = isMalePreferencesComplete(malePreferences);
      if (!hasCompletedPreferences) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error setting welcome status:', error);
      // Even if saving fails, still hide welcome to prevent loop
      setShowWelcome(false);
    }
  };

  // Handle start onboarding from welcome page
  const handleStartOnboarding = async () => {
    await handleWelcomeComplete();
    setShowOnboarding(true);
  };

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    console.log('Onboarding completion started');
    setShowOnboarding(false);
    setCheckingWelcome(true);
    
    try {
      // 設定完了状況を再確認
      if (currentUser) {
        const malePreferences = await getMalePreferences(currentUser.uid);
        const hasCompletedPreferences = isMalePreferencesComplete(malePreferences);
        
        console.log('Preferences completion check:', {
          preferences: malePreferences,
          isComplete: hasCompletedPreferences
        });
        
        if (hasCompletedPreferences) {
          // 設定が完了している場合、状態をリセット
          setShowWelcome(false);
          setShowOnboarding(false);
          console.log('Onboarding completed successfully, showing home page');
        } else {
          // まだ完了していない場合は再度オンボーディングを表示
          console.log('Preferences not complete, showing onboarding again');
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error checking completion status:', error);
      // エラーの場合はページリロード
      window.location.reload();
    } finally {
      setCheckingWelcome(false);
    }
  };

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
        
        // 新しい優先順位ソート機能を使用
        // 1. GPS位置情報 → 2. プロフィール住所 → 3. 活動エリア の順で優先
        fetchedUsers = await sortUsersByPreference(
          fetchedUsers,
          currentUser.uid,
          userLocation,
          userProfile?.location
        );
        
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
      
      // 新しい優先順位ソート機能を使用（リセット時も同じロジック）
      fetchedUsers = await sortUsersByPreference(
        fetchedUsers,
        currentUser.uid,
        userLocation,
        userProfile?.location
      );
      
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // エラー時は空配列
    } finally {
      setLoadingUsers(false);
    }
  }

  if (isLoading || loadingUsers || checkingWelcome) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or during transition:
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  // Show welcome page for first-time male users
  if (showWelcome) {
    return <WelcomePage onComplete={handleWelcomeComplete} onStartOnboarding={handleStartOnboarding} />;
  }

  // Show onboarding for male users who haven't completed preferences
  if (showOnboarding && currentUser) {
    return <MaleOnboarding userId={currentUser.uid} userEmail={currentUser.email || undefined} onComplete={handleOnboardingComplete} />;
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
