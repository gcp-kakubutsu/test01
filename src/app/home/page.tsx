
"use client";

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { fetchAdminGirls, type UserProfile } from '@/lib/firebase/user-utils';
import { GirlWithDetails } from '@/types/database';
import { sortGirlsByPreference } from '@/lib/utils/girlSorting';
import { recordProfileView } from '@/lib/firebase/actions';
import { getCurrentLocation, type LocationCoordinates } from '@/lib/utils/location';
import { getLocationCoordinates } from '@/lib/utils/japanLocations';
import { sortUsersByPreference } from '@/lib/utils/userSorting';
import { useUserProfile } from '@/lib/firebase/hooks';
import WelcomePage from '@/components/WelcomePage';
import MaleOnboarding from '@/components/MaleOnboarding';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getMalePreferences, isMalePreferencesComplete } from '@/lib/firebase/malePreferences';
import Image from 'next/image';
import { useSubscription } from '@/hooks/useSubscription';
import '@/styles/blur.css';

const USERS_PER_PAGE = 20;

export default function HomePage() {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const { profile: userProfile } = useUserProfile();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [girlsFromDB, setGirlsFromDB] = useState<GirlWithDetails[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingWelcome, setCheckingWelcome] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [useFirebaseData] = useState(false); // MySQL only - Firebase disabled

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check if user should see welcome page or onboarding (male users)
  useEffect(() => {
    let isMounted = true;
    
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
        // Check if component is still mounted and user is still authenticated
        if (!isMounted || !currentUser) return;
        
        // Check if user has seen welcome
        const welcomeRef = doc(db, 'userSettings', currentUser.uid);
        const welcomeDoc = await getDoc(welcomeRef);
        
        // Check again after async operation
        if (!isMounted || !currentUser) return;
        
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
      } catch (error: any) {
        // Check if still mounted before handling error
        if (!isMounted) return;
        
        // Silently handle permission errors during logout
        if (error?.code === 'permission-denied' || 
            error?.message?.includes('Missing or insufficient permissions')) {
          console.log('Permission denied in welcome check - likely during logout');
          setCheckingWelcome(false);
          return;
        }
        
        console.error('Error checking welcome status:', error);
      } finally {
        if (isMounted) {
          setCheckingWelcome(false);
        }
      }
    };

    if (isAuthenticated && currentUser && userProfile) {
      checkWelcomeStatus();
    } else if (isAuthenticated && currentUser && !isLoading) {
      // If authenticated but no profile yet, still stop checking
      setCheckingWelcome(false);
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, currentUser, userProfile, isLoading]);

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

  // 位置情報が更新されたらデータを再取得
  useEffect(() => {
    if (userLocation && girlsFromDB.length > 0 && !loadingUsers && currentUser) {
      fetchGirlsFromMySQL();
    }
  }, [userLocation]);

  // MySQLからの女の子データ取得（最適化版）
  const fetchGirlsFromMySQL = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const startTime = performance.now();
      
      // First try without area filter to ensure we get data
      const params = new URLSearchParams({
        limit: '200',
        offset: '0'
      });
      
      // Don't filter by area initially - let client-side sorting handle location preference
      // This prevents issues when the area doesn't match exactly
      
      // Try optimized API first
      let data = null;
      let apiUsed = 'optimized';
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries && !data?.girls?.length) {
        try {
          const response = await fetch(`/api/mysql-girls-fast?${params}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const responseData = await response.json();
          
          // Check if we got valid data
          if (responseData && responseData.girls && Array.isArray(responseData.girls)) {
            data = responseData;
            break;
          } else {
            retryCount++;
          }
        } catch (optimizedError) {
          retryCount++;
          
          if (retryCount > maxRetries) {
            // Final fallback to regular API
            apiUsed = 'regular';
            
            try {
              const response = await fetch(`/api/girls?limit=200&offset=0`);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status} from regular API`);
              }
              data = await response.json();
            } catch (fallbackError) {
              console.error('Regular API also failed:', fallbackError);
              throw fallbackError;
            }
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      
      // Validate and process the data
      if (data && data.girls && Array.isArray(data.girls) && data.girls.length > 0) {
        
        // Convert MySQLGirlProfile to GirlWithDetails format for sorting
        const girlsWithDetails = data.girls.map((girl: any) => {
          let shop = girl.shop || {
            id: girl.shopId,
            name: girl.shopName,
            latitude: girl.latitude,
            longitude: girl.longitude
          };
          
          // If shop doesn't have coordinates but has location, use approximate coordinates
          if ((!shop.latitude || !shop.longitude) && girl.location) {
            const coords = getLocationCoordinates(girl.location);
            if (coords) {
              shop = {
                ...shop,
                latitude: coords.lat,
                longitude: coords.lng
              };
            }
          }
          
          return {
            ...girl,
            id: parseInt(girl.id),
            shop
          };
        });
        
        // Sort girls by user preferences (including location preference)
        const sortedGirls = await sortGirlsByPreference(
          girlsWithDetails,
          currentUser.uid,
          userLocation,
          userProfile?.location
        );
        
        setGirlsFromDB(sortedGirls);
        
      } else {
        // Try once more without any filters as last resort
        try {
          const lastResortResponse = await fetch('/api/mysql-girls?limit=200&offset=0');
          if (lastResortResponse.ok) {
            const lastResortData = await lastResortResponse.json();
            if (lastResortData?.girls?.length > 0) {
              // Convert MySQLGirlProfile to GirlWithDetails format
              const girlsWithDetails = lastResortData.girls.map((girl: any) => {
                let shop = girl.shop || {
                  id: girl.shopId,
                  name: girl.shopName,
                  latitude: girl.latitude,
                  longitude: girl.longitude
                };
                
                // Use approximate coordinates if needed
                if ((!shop.latitude || !shop.longitude) && girl.location) {
                  const coords = getLocationCoordinates(girl.location);
                  if (coords) {
                    shop = {
                      ...shop,
                      latitude: coords.lat,
                      longitude: coords.lng
                    };
                  }
                }
                
                return {
                  ...girl,
                  id: parseInt(girl.id),
                  shop
                };
              });
              const sortedGirls = await sortGirlsByPreference(
                girlsWithDetails,
                currentUser.uid,
                userLocation,
                userProfile?.location
              );
              setGirlsFromDB(sortedGirls);
            } else {
              setGirlsFromDB([]);
            }
          } else {
            setGirlsFromDB([]);
          }
        } catch (lastError) {
          console.error('Last resort fetch also failed:', lastError);
          setGirlsFromDB([]);
        }
      }
    } catch (error) {
      console.error('Error fetching girls from MySQL:', error);
      setGirlsFromDB([]);
    }
  }, [currentUser, userLocation, userProfile]);

  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoadingUsers(true);
      
      if (useFirebaseData) {
        // 共通関数を使用してFirebaseから管理者登録の女性ユーザーを取得（より多く取得）
        let fetchedUsers = await fetchAdminGirls(currentUser.uid, 200);
        
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
      } else {
        // MySQLから女の子データを取得
        await fetchGirlsFromMySQL();
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // エラー時は空配列
      setGirlsFromDB([]); // MySQLデータもクリア
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUser, useFirebaseData, userLocation, userProfile, fetchGirlsFromMySQL]);

  useEffect(() => {
    // Don't wait for userProfile if it's not a male user
    // Wait for location to be fetched before loading users for better distance calculation
    if (isAuthenticated && currentUser && !checkingWelcome) {
      // Delay fetch to allow location to be obtained first
      const timer = setTimeout(() => {
        fetchUsers();
      }, 1000); // Give 1 second for location to be obtained
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentUser, checkingWelcome, fetchUsers]);

  const handleReset = async () => {
    if (!currentUser) return;
    
    try {
      setLoadingUsers(true);
      
      // 位置情報を再取得
      try {
        const locationInfo = await getCurrentLocation();
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates);
        }
      } catch (error) {
        // Silently handle location errors
      }
      
      // MySQLから女の子データを再取得
      await fetchGirlsFromMySQL();
      
      setCurrentPage(1); // リセット時は最初のページに戻る
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // エラー時は空配列
      setGirlsFromDB([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  if (isLoading || (loadingUsers && !users.length && !girlsFromDB.length) || (checkingWelcome && userProfile?.gender === 'male') || subscriptionLoading) {
    return <div className="flex justify-center items-center h-screen bg-white dark:bg-black"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-gray-900 dark:text-white">読み込み中...</p></div>;
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or during transition:
    return <div className="flex justify-center items-center h-screen bg-white dark:bg-black"><p className="text-gray-900 dark:text-white">ログインページへリダイレクト中...</p></div>;
  }

  // Show welcome page for first-time male users
  if (showWelcome) {
    return <WelcomePage onComplete={handleWelcomeComplete} onStartOnboarding={handleStartOnboarding} />;
  }

  // Show onboarding for male users who haven't completed preferences
  if (showOnboarding && currentUser) {
    return <MaleOnboarding userId={currentUser.uid} userEmail={currentUser.email || undefined} onComplete={handleOnboardingComplete} />;
  }

  // Determine which data to display
  const displayData = useFirebaseData ? users : girlsFromDB;
  
  // Show loading state while fetching users
  if (loadingUsers) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-gray-900 dark:text-white">プロフィールを読み込み中...</p>
      </div>
    );
  }
  
  if (displayData.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-black min-h-screen">
        <div className="text-center py-10">
          <p className="text-gray-900 dark:text-white mb-4">
            現在表示できるプロフィールはありません。
          </p>
          <Button 
            onClick={() => {
              setLoadingUsers(true);
              fetchUsers();
            }}
            variant="outline"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(displayData.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const currentDisplayData = displayData.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white dark:bg-black" style={{ minHeight: '100vh' }}>
      {/* Banner Image */}
      <div className="w-full">
        <div className="relative h-32 sm:h-40 md:h-64 lg:h-80 xl:h-96">
          <Image 
            src="/img/sod.webp" 
            alt="Nukune Banner" 
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
      
      <div className="px-4 pb-6">
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {currentDisplayData.map((item: any) => {
          // Handle both UserProfile and GirlWithDetails types
          // Check if it's Firebase data by looking for unique Firebase fields
          const isFirebaseData = 'uid' in item || ('email' in item && !('shopName' in item));
          const id = isFirebaseData ? item.id : `girl-${item.id}`;
          const name = item.name;
          const age = item.age;
          const location = item.location;
          const imageUrl = item.imageUrl || (item.images?.[0]?.image_url || item.images?.[0]?.real_image_url);
          
          // スタイル情報
          const height = item.height;
          const bust = item.bust;
          const cup = item.cup;
          const waist = item.waist;
          const hip = item.hip;
          
          // Calculate distance if user location and shop coordinates exist
          let distance: number | null = null;
          if (userLocation && item.shop?.latitude && item.shop?.longitude) {
            const R = 6371; // Earth radius in km
            const dLat = (item.shop.latitude - userLocation.lat) * Math.PI / 180;
            const dLon = (item.shop.longitude - userLocation.lng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(item.shop.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
          }
          
          return (
            <div
              key={id}
              className="relative cursor-pointer transform transition-transform hover:scale-105"
              onClick={() => {
                if (isFirebaseData) {
                  router.push(`/user/${item.id}`);
                  recordProfileView(currentUser!.uid, item.id);
                } else {
                  // For MySQL data, use /girl route
                  router.push(`/girl/${item.id}`);
                }
              }}
            >
              <div className="aspect-[3/4] relative rounded-lg overflow-hidden shadow-md bg-gray-800">
                <Image
                  src={imageUrl || 'https://placehold.co/400x600/FFB6C1/FFFFFF?text=No+Photo'}
                  alt={name}
                  fill
                  className={`object-cover ${!isPremium ? 'blur-image' : ''}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
                  <p className="!text-white font-bold text-base sm:text-lg drop-shadow-lg" style={{ color: '#FFFFFF' }}>{name}{age ? `, ${age}` : ''}</p>
                  {location && (
                    <p className="!text-white/90 text-sm drop-shadow-lg" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      {location}
                      {distance !== null && (
                        <span className="ml-1">({distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`})</span>
                      )}
                    </p>
                  )}
                  {/* スタイル情報の表示 - スマホでも見やすいサイズに */}
                  {height && (
                    <p className="!text-white text-sm sm:text-sm font-medium mt-1 drop-shadow-lg" style={{ color: '#FFFFFF' }}>
                      {height}cm
                      {bust && waist && hip && (
                        <>
                          <br />
                          <span className="text-sm">B{bust}{cup && `(${cup})`} W{waist} H{hip}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {displayData.length === 0 && (
        <div className="text-center py-10 text-gray-300">
          <p className="text-xl mb-4 text-white">現在表示できるプロフィールはありません！</p>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> プロフィールを再読み込み
          </Button>
        </div>
      )}
      
      {/* Pagination */}
      {displayData.length > 0 && (
        <div className="flex justify-center items-center mt-8 gap-2 sm:gap-4">
          <Button
            variant="outline"
            size="default"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 sm:px-4"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>前へ</span>
          </Button>
          
          <div className="flex items-center gap-2 px-2 sm:px-4">
            <span className="text-sm sm:text-base font-semibold min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="default"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 sm:px-4"
          >
            <span>次へ</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Footer Logo */}
      <div className="w-full">
        <div className="relative h-32 sm:h-40 md:h-64 lg:h-80 xl:h-96">
          <Image 
            src="/img/sodland.webp" 
            alt="Nukune Logo" 
            fill
            className="object-contain"
          />
        </div>
      </div>
      </div>
    </div>
  );
}
