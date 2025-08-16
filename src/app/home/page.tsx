
"use client";

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Heart, Grid3x3, Columns, Search, X, StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { sendLike } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';

const USERS_PER_PAGE = 20;

export default function HomePage() {
  const { isAuthenticated, currentUser } = useAuth();
  const { profile: userProfile } = useUserProfile();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [girlsFromDB, setGirlsFromDB] = useState<GirlWithDetails[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingWelcome, setCheckingWelcome] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [useFirebaseData] = useState(false); // MySQL only - Firebase disabled
  const [viewMode, setViewMode] = useState<'single' | 'double'>('double'); // Default to 2 columns
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // 認証チェック
  useEffect(() => {
    // 1秒待ってからチェック（セッション確認のため）
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.push('/login');
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

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

      // Set checking to false immediately to show content faster
      setCheckingWelcome(false);

      try {
        // Check if component is still mounted and user is still authenticated
        if (!isMounted || !currentUser) return;
        
        // Check if user has seen welcome (non-blocking)
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
    } else if (isAuthenticated && currentUser) {
      // If authenticated but no profile yet, still stop checking
      setCheckingWelcome(false);
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
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

  // Reset page to 1 when search keyword changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 認証確認中（1秒間）
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    // すぐに表示するか、1秒待つ
    if (isAuthenticated) {
      setShowContent(true);
    } else {
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);
  
  // コンテンツ表示前
  if (!showContent) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-gray-900 dark:text-white">読み込み中...</p>
      </div>
    );
  }

  if ((loadingUsers && !users.length && !girlsFromDB.length) || (checkingWelcome && userProfile?.gender === 'male') || subscriptionLoading) {
    return <div className="flex justify-center items-center h-screen bg-white dark:bg-black"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-gray-900 dark:text-white">読み込み中...</p></div>;
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

  // Apply search filter and sort to all data first
  const filteredAndSortedData = displayData
    .filter((item: any) => {
      // Apply keyword filter
      if (!searchKeyword) return true;
      
      const keyword = searchKeyword.toLowerCase();
      const name = item.name?.toLowerCase() || '';
      const bio = (item.bio || item.pr_message || '').toLowerCase();
      const interests = (item.interests || []).join(' ').toLowerCase();
      const girlTypes = (item.girlTypes || []).join(' ').toLowerCase();
      const playTypes = (item.play_types || []).join(' ').toLowerCase();
      const options = (item.options || []).join(' ').toLowerCase();
      const tags = (item.tags || []).join(' ').toLowerCase();
      
      // Check all fields for keyword
      return name.includes(keyword) ||
             bio.includes(keyword) ||
             interests.includes(keyword) ||
             girlTypes.includes(keyword) ||
             playTypes.includes(keyword) ||
             options.includes(keyword) ||
             tags.includes(keyword);
    })
    .sort((a: any, b: any) => {
      // Sort by keyword relevance if keyword exists
      if (!searchKeyword) return 0;
      
      const keyword = searchKeyword.toLowerCase();
      
      // Calculate relevance score for each item
      const getRelevanceScore = (item: any) => {
        let score = 0;
        const name = item.name?.toLowerCase() || '';
        const girlTypes = (item.girlTypes || []).join(' ').toLowerCase();
        const playTypes = (item.play_types || []).join(' ').toLowerCase();
        
        // Higher score for exact matches in important fields
        if (name.includes(keyword)) score += 10;
        if (girlTypes.includes(keyword)) score += 8;
        if (playTypes.includes(keyword)) score += 6;
        
        // Bonus for exact type match
        if (item.girlTypes?.some((type: string) => type.toLowerCase() === keyword)) score += 15;
        if (item.play_types?.some((type: string) => type.toLowerCase() === keyword)) score += 12;
        
        return score;
      };
      
      const scoreA = getRelevanceScore(a);
      const scoreB = getRelevanceScore(b);
      
      return scoreB - scoreA; // Sort by descending score
    });

  // Calculate pagination based on filtered data
  const totalPages = Math.ceil(filteredAndSortedData.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const currentDisplayData = filteredAndSortedData.slice(startIndex, endIndex);

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
        {/* Search and View mode controls */}
        <div className="flex justify-between items-center mb-4">
          {/* Search input or button */}
          <div className="flex-1 mr-2">
            {showSearchInput ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="キーワード検索（エロい、巨乳、癒し系など）"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Apply search on Enter
                      setShowSearchInput(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchKeyword('');
                    setShowSearchInput(false);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSearchInput(true)}
                  className="flex-1 bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {searchKeyword || 'キーワード検索'}
                </Button>
                {searchKeyword && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSearchKeyword('')}
                    className="text-gray-400 hover:text-white"
                    title="検索をクリア"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {/* View mode toggle for mobile */}
          <div className="inline-flex bg-gray-800 rounded-lg p-1 border border-gray-700 sm:hidden">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-2 rounded-md transition-all ${
                viewMode === 'single' 
                  ? 'bg-pink-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              aria-label="1列表示"
            >
              <Columns className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('double')}
              className={`px-3 py-2 rounded-md transition-all ${
                viewMode === 'double' 
                  ? 'bg-pink-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              aria-label="2列表示"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className={`grid ${
          viewMode === 'single' 
            ? 'grid-cols-1' 
            : 'grid-cols-2'
        } sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6`}>
        {currentDisplayData.map((item: any) => {
          // Handle both UserProfile and GirlWithDetails types
          // Check if it's Firebase data by looking for unique Firebase fields
          const isFirebaseData = 'uid' in item || ('email' in item && !('shopName' in item));
          const id = isFirebaseData ? item.id : `girl-${item.id}`;
          const name = item.name;
          const age = item.age;
          const location = item.location;
          const imageUrl = item.imageUrl || (item.images?.[0]?.image_url || item.images?.[0]?.real_image_url);
          const bio = item.bio || item.pr_message || '';
          const interests = item.interests || [];
          const play_types = item.play_types || [];
          const options = item.options || [];
          const tags = item.tags || [];
          const is_sake = item.is_sake;
          const is_tobacco = item.is_tobacco;
          const girlTypes = item.girlTypes || [];
          
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
              className="bg-gray-800/80 dark:bg-gray-800/80 rounded-2xl overflow-hidden border border-gray-700 transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-xl hover:border-pink-500/50 flex flex-col h-full"
            >
              {/* Image Section */}
              <div 
                className="relative aspect-[3/4] overflow-hidden cursor-pointer"
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
                <Image
                  src={imageUrl || 'https://placehold.co/400x600/FFB6C1/FFFFFF?text=No+Photo'}
                  alt={name}
                  fill
                  className={`object-contain transition-transform duration-300 hover:scale-105 ${!isPremium ? 'blur-image' : ''}`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                {!isPremium && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                )}
              </div>
              
              {/* Content Section */}
              <div className={`${
                viewMode === 'single' ? 'p-4' : 'p-3'
              } sm:p-6 flex-1 flex flex-col`}>
                {/* Name */}
                <h3 
                  className={`${
                    viewMode === 'single' ? 'text-xl' : 'text-base'
                  } sm:text-xl font-semibold text-white mb-2 cursor-pointer hover:text-pink-500 transition-colors`}
                  onClick={() => {
                    if (isFirebaseData) {
                      router.push(`/user/${item.id}`);
                      recordProfileView(currentUser!.uid, item.id);
                    } else {
                      router.push(`/girl/${item.id}`);
                    }
                  }}
                >
                  {name}
                </h3>
                
                {/* Details */}
                <div className={`flex flex-wrap gap-2 ${
                  viewMode === 'single' ? 'text-sm' : 'text-xs'
                } sm:text-sm text-gray-400 mb-2`}>
                  <span>{age ? `${age}歳` : '不明'}</span>
                  <span>•</span>
                  <span>{location}</span>
                  {distance !== null && (
                    <>
                      <span>•</span>
                      <span className="text-yellow-500 font-semibold">
                        {distance < 1 
                          ? `${Math.round(distance * 1000)}m先` 
                          : `${distance.toFixed(1)}km先`}
                      </span>
                    </>
                  )}
                </div>
                
                {/* Body Info */}
                {height && (
                  <div className={`${
                    viewMode === 'single' ? 'text-sm' : 'text-xs'
                  } sm:text-sm text-gray-400 mb-3`}>
                    {height && <span>T{height}cm</span>}
                    {bust && waist && hip && (
                      <>
                        {height && <span> • </span>}
                        <span>B{bust}{cup ? `(${cup})` : ''} W{waist} H{hip}</span>
                      </>
                    )}
                  </div>
                )}
                
                {/* Tags & Play Types */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Girl Types (明るい、癒し系、巨乳など) */}
                  {girlTypes.slice(0, 3).map((type: string) => (
                    <span 
                      key={`type-${type}`} 
                      className="px-3 py-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/40 rounded-full text-xs text-pink-300 font-medium"
                    >
                      ✨ {type}
                    </span>
                  ))}
                  
                  {/* Interests */}
                  {interests.slice(0, 2).map((interest: string) => (
                    <span 
                      key={`interest-${interest}`} 
                      className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs text-yellow-500"
                    >
                      {interest}
                    </span>
                  ))}
                  
                  {/* Play Types (エロい要素) */}
                  {play_types.slice(0, 2).map((play: string) => (
                    <span 
                      key={`play-${play}`} 
                      className="px-3 py-1 bg-pink-500/10 border border-pink-500/30 rounded-full text-xs text-pink-400"
                    >
                      {play}
                    </span>
                  ))}
                  
                  {/* Options */}
                  {options.slice(0, 1).map((option: string) => (
                    <span 
                      key={`option-${option}`} 
                      className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-xs text-purple-400"
                    >
                      {option}
                    </span>
                  ))}
                  
                  {/* Additional tags */}
                  {tags.slice(0, 1).map((tag: string) => (
                    <span 
                      key={`tag-${tag}`} 
                      className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs text-blue-400"
                    >
                      {tag}
                    </span>
                  ))}
                  
                  {/* お酒・タバコ */}
                  {is_sake !== undefined && (
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-400">
                      {is_sake ? '🍺 お酒OK' : '🚫 お酒NG'}
                    </span>
                  )}
                  {is_tobacco !== undefined && (
                    <span className="px-3 py-1 bg-gray-500/10 border border-gray-500/30 rounded-full text-xs text-gray-400">
                      {is_tobacco ? '🚬 タバコOK' : '🚫 タバコNG'}
                    </span>
                  )}
                </div>
                
                {/* Bio */}
                {bio && (
                  <p className={`${
                    viewMode === 'single' ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'
                  } sm:text-sm text-gray-400 mb-4 flex-1`}>
                    {bio}
                  </p>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="outline"
                    className={`flex-1 bg-pink-500/20 text-pink-500 border-pink-500 hover:bg-pink-500 hover:text-white transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                      viewMode === 'single' ? 'text-sm' : 'text-xs py-1.5'
                    } sm:text-sm`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      
                      // ログインチェック
                      if (!currentUser) {
                        toast({
                          title: 'ログインが必要です',
                          description: 'いいねを送るにはログインしてください',
                          variant: 'destructive'
                        });
                        router.push('/login');
                        return;
                      }
                      
                      // 有料会員チェック
                      if (!isPremium) {
                        toast({
                          title: '有料会員限定',
                          description: 'いいねを送るには有料会員登録が必要です',
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
                      
                      // いいねを送信
                      try {
                        const targetId = `mysql_girl_${item.id}`;
                        const result = await sendLike(currentUser.uid, targetId, {
                          toGirlName: name,
                          toGirlId: item.id,
                          isGirlProfile: true
                        });
                        
                        if (result.alreadyLiked) {
                          toast({
                            title: '既にいいねを送っています',
                            description: `${name}さんには既にいいねを送信済みです。`,
                          });
                        } else {
                          toast({
                            title: 'いいねを送りました！',
                            description: `${name}さんにいいねを送りました。`
                          });
                        }
                      } catch (error) {
                        console.error('Like error:', error);
                        toast({
                          title: 'エラー',
                          description: 'いいねの送信に失敗しました。',
                          variant: 'destructive'
                        });
                      }
                    }}
                  >
                    <Heart className="w-4 h-4" />
                    いいね
                  </Button>
                  {isPremium && (
                    <Button
                      className={`flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 hover:from-yellow-600 hover:to-amber-600 transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                        viewMode === 'single' ? 'text-sm' : 'text-xs py-1.5'
                      } sm:text-sm`}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/messages/${item.id}`);
                      }}
                    >
                      <StickyNote className="w-4 h-4" />
                      メモ
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredAndSortedData.length === 0 && searchKeyword && (
        <div className="text-center py-10 text-gray-300">
          <p className="text-xl mb-4 text-white">「{searchKeyword}」に一致する女の子が見つかりません</p>
          <Button onClick={() => setSearchKeyword('')} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> 検索をクリア
          </Button>
        </div>
      )}
      
      {displayData.length === 0 && !searchKeyword && (
        <div className="text-center py-10 text-gray-300">
          <p className="text-xl mb-4 text-white">現在表示できるプロフィールはありません！</p>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> プロフィールを再読み込み
          </Button>
        </div>
      )}
      
      {/* Pagination */}
      {filteredAndSortedData.length > 0 && (
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
      
      {/* Search results info */}
      {searchKeyword && filteredAndSortedData.length > 0 && (
        <div className="text-center mt-4 text-gray-400">
          <p>「{searchKeyword}」の検索結果: {filteredAndSortedData.length}名</p>
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
