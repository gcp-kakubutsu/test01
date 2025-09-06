
"use client";

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, RotateCcw, Heart, Grid3x3, Columns, Search, X, StickyNote, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchAdminGirls, type UserProfile } from '@/lib/firebase/user-utils';
import { GirlWithDetails } from '@/types/database';
import { sortGirlsByPreference } from '@/lib/utils/girlSorting';
import { recordProfileView } from '@/lib/firebase/actions';
import { getCurrentLocation, type LocationCoordinates } from '@/lib/utils/location';
import { getLocationCoordinates } from '@/lib/utils/japanLocations';
import { sortUsersByPreference } from '@/lib/utils/userSorting';
import { useUserProfile } from '@/lib/firebase/hooks';
import { useLikeOptimistic } from '@/lib/hooks/useLikeOptimistic';
import { useMemoOptimistic } from '@/lib/hooks/useMemoOptimistic';
import WelcomePage from '@/components/WelcomePage';
import MaleOnboarding from '@/components/MaleOnboarding';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getMalePreferences, isMalePreferencesComplete, saveMalePreferences, type MalePreferences } from '@/lib/firebase/malePreferences';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/contexts/SubscriptionContext';
import '@/styles/blur.css';
import { useToast } from '@/hooks/use-toast';
import { isLineBrowser } from '@/lib/utils/browser-detection';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { fetchWithDedup, roundLocation, generateCacheKey } from '@/lib/utils/api-request-manager';

const USERS_PER_PAGE = 20;

export default function HomePage() {
  const { isAuthenticated, currentUser, firebaseSynced } = useAuth(); // search/advancedと同じく、isLoadingやhasInitializedを使わない
  const { profile: userProfile } = useUserProfile();
  const { hasPremium, isLoading: subscriptionLoading } = useSubscription();
  const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
  const router = useRouter();
  const { toast } = useToast();
  const { handleLikeOptimistic, likingStates, isLiked } = useLikeOptimistic();
  const { prefetchMemoPage, handleMemoNavigation, navigatingStates } = useMemoOptimistic();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [girlsFromDB, setGirlsFromDB] = useState<GirlWithDetails[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false); // LINEブラウザ対応: 初期値をfalseに
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingWelcome, setCheckingWelcome] = useState(false); // LINEブラウザ対応: 即座にデータ取得
  const [initialFetchDone, setInitialFetchDone] = useState(false); // 初回データ取得完了フラグ
  const [sortedGirlsCache, setSortedGirlsCache] = useState<GirlWithDetails[] | null>(null); // ソート済みデータのキャッシュ
  const [isSorting, setIsSorting] = useState(false); // ソート処理中フラグ
  const [hasInitialSort, setHasInitialSort] = useState(false); // 初回ソート完了フラグ
  const authStateRef = useRef({ currentUser, userProfile, firebaseSynced }); // 認証状態の参照
  
  // 認証状態の参照を更新
  useEffect(() => {
    authStateRef.current = { currentUser, userProfile, firebaseSynced };
  }, [currentUser, userProfile, firebaseSynced]);
  const [currentPage, setCurrentPage] = useState(1);
  const [useFirebaseData] = useState(false); // MySQL only - Firebase disabled
  const [viewMode, setViewMode] = useState<'single' | 'double'>('double'); // Default to 2 columns
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [girlTypes, setGirlTypes] = useState<any[]>([]); // 女の子タイプのマスターデータ
  const [selectedGirlTypes, setSelectedGirlTypes] = useState<number[]>([]); // 選択された女の子タイプID
  const [showTypeFilter, setShowTypeFilter] = useState(false); // タイプフィルター表示フラグ
  const [showPreferenceSliders, setShowPreferenceSliders] = useState(false); // 嗜好スライダー表示フラグ
  const [preferences, setPreferences] = useState<MalePreferences | null>(null); // ユーザーの嗜好設定
  const [savingPreferences, setSavingPreferences] = useState(false); // 嗜好保存中フラグ
  const preferencePanelRef = useRef<HTMLDivElement>(null); // 嗜好設定パネルの参照

  // 認証チェック: ログインしていない場合はログインページへリダイレクト
  useEffect(() => {
    if (!isAuthenticated && !currentUser) {
      router.push('/login');
    }
  }, [isAuthenticated, currentUser, router]);

  // ユーザーの嗜好設定を読み込み（設定がない場合はデフォルト値を使用）
  useEffect(() => {
    const loadPreferences = async () => {
      if (currentUser) { // 男性ユーザーのみなので性別チェック不要
        try {
          const prefs = await getMalePreferences(currentUser.uid);
          if (prefs) {
            setPreferences(prefs);
          } else {
            // 設定がない場合はデフォルト値を使用
            console.log('No preferences found, using default values');
            const defaultPrefs: MalePreferences = {
              groupPlay: 3,
              throating: 3,
              analPlay: 3,
              cosplay: 3,
              toyPlay: 3,
              deepthroat: 3,
              partnerBodyTypes: ['こだわらない'],
              girlTypeIds: [],
              recordingDuringPlay: 'しない',
              isSadist: 'わからない',
              isMasochist: 'わからない',
              partnerHeight: 'こだわらない',
              partnerWeight: 'こだわらない',
              partnerLocation: userProfile?.location || 'こだわらない',
              partnerAgeMin: 18,
              partnerAgeMax: 40,
              isComplete: false
            };
            setPreferences(defaultPrefs);
          }
        } catch (error) {
          console.error('Failed to load preferences:', error);
          // エラー時もデフォルト値を設定
          const defaultPrefs: MalePreferences = {
            groupPlay: 3,
            throating: 3,
            analPlay: 3,
            cosplay: 3,
            toyPlay: 3,
            deepthroat: 3,
            partnerBodyTypes: ['こだわらない'],
            girlTypeIds: [],
            recordingDuringPlay: 'no',
            isSadist: 'neutral',
            isMasochist: 'neutral',
            partnerHeight: 'こだわらない',
            partnerWeight: 'こだわらない',
            partnerLocation: userProfile?.location || 'こだわらない',
            partnerAgeMin: 18,
            partnerAgeMax: 40,
            isComplete: false
          };
          setPreferences(defaultPrefs);
        }
      }
    };

    loadPreferences();
  }, [currentUser, userProfile]);

  // 嗜好設定パネルの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPreferenceSliders && 
          preferencePanelRef.current && 
          !preferencePanelRef.current.contains(event.target as Node)) {
        setShowPreferenceSliders(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPreferenceSliders]);

  // Check if user should see welcome page or onboarding (male users)
  useEffect(() => {
    let isMounted = true;
    
    const checkWelcomeStatus = async () => {
      // LINEブラウザ対応: データがなくても処理を続行
      if (!db) {
        setCheckingWelcome(false);
        return;
      }
      
      if (!currentUser || !userProfile) {
        setCheckingWelcome(false);
        return;
      }

      // 男性ユーザーのみなので性別チェック不要

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
        const malePreferences = currentUser?.uid ? await getMalePreferences(currentUser.uid) : null;
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
          // Permission denied in welcome check - likely during logout (silent)
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
      const malePreferences = currentUser?.uid ? await getMalePreferences(currentUser.uid) : null;
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
      if (currentUser?.uid) {
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

  // 嗜好設定を保存（数値フィールド用）
  const savePreferenceScore = async (field: keyof MalePreferences, value: number) => {
    if (!currentUser || !preferences) return;
    
    try {
      setSavingPreferences(true);
      const updatedPreferences = { ...preferences, [field]: value };
      setPreferences(updatedPreferences);
      await saveMalePreferences(currentUser.uid, updatedPreferences);
      
      // データを再ソート
      if (sortedGirlsCache && currentUser?.uid) {
        setIsSorting(true);
        const sortedData = await sortGirlsByPreference(sortedGirlsCache, currentUser.uid, userLocation);
        setSortedGirlsCache(sortedData);
        setIsSorting(false);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
      toast({
        title: "エラー",
        description: "嗜好の保存に失敗しました",
        variant: "destructive"
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  // 嗜好設定を保存（文字列フィールド用）
  const savePreferenceString = async (field: keyof MalePreferences, value: string) => {
    if (!currentUser || !preferences) return;
    
    try {
      setSavingPreferences(true);
      const updatedPreferences = { ...preferences, [field]: value };
      setPreferences(updatedPreferences);
      await saveMalePreferences(currentUser.uid, updatedPreferences);
      
      // データを再ソート
      if (sortedGirlsCache && currentUser?.uid) {
        setIsSorting(true);
        const sortedData = await sortGirlsByPreference(sortedGirlsCache, currentUser.uid, userLocation);
        setSortedGirlsCache(sortedData);
        setIsSorting(false);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
      toast({
        title: "エラー",
        description: "嗜好の保存に失敗しました",
        variant: "destructive"
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  // 嗜好設定を保存（配列フィールド用）
  const savePreferenceArray = async (field: keyof MalePreferences, value: string[] | number[]) => {
    if (!currentUser || !preferences) return;
    
    try {
      setSavingPreferences(true);
      const updatedPreferences = { ...preferences, [field]: value };
      setPreferences(updatedPreferences);
      await saveMalePreferences(currentUser.uid, updatedPreferences);
      
      // データを再ソート
      if (sortedGirlsCache && currentUser?.uid) {
        setIsSorting(true);
        const sortedData = await sortGirlsByPreference(sortedGirlsCache, currentUser.uid, userLocation);
        setSortedGirlsCache(sortedData);
        setIsSorting(false);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
      toast({
        title: "エラー",
        description: "嗜好の保存に失敗しました",
        variant: "destructive"
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  // Reset page to 1 when search keyword or selected types change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedGirlTypes]);

  // 位置情報を取得（高速化：住所取得をスキップ）
  useEffect(() => {
    const getLocation = async () => {
      try {
        const locationInfo = await getCurrentLocation(true); // 住所取得をスキップして高速化
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates);
        }
      } catch (error) {
        console.error('位置情報取得エラー:', error);
        // 位置情報が取得できない場合は、フォールバックとして東京の座標を設定
        // これにより東京エリアの女の子が優先的に表示される
        console.log('📍 位置情報取得失敗 - 東京エリアをデフォルト表示に設定');
        // 注: 位置情報なしの状態を保持し、API側で東京フィルターを適用
        // setUserLocation(null)のままにして、fetchGirlsFromMySQL内で処理
      }
    };

    if (isAuthenticated) {
      getLocation();
    }
  }, [isAuthenticated]);

  // データがキャッシュされたら、認証状態に応じて初回ソート
  useEffect(() => {
    // データがない、または既にソート済みの場合はスキップ
    if (!sortedGirlsCache || sortedGirlsCache.length === 0 || hasInitialSort) return;
    
    // サーバー側でソート済み（位置情報がある場合）はクライアント側のソートをスキップ
    if (userLocation) {
      console.log('⚡ [useEffect] Server-side sorted data detected, skipping client-side sort');
      setGirlsFromDB(sortedGirlsCache);
      setHasInitialSort(true);
      return;
    }
    
    console.log('📊 [useEffect] Data cached, performing initial sort...');
    
    const performInitialSort = async () => {
      setIsSorting(true);
      
      // 認証を少し待つ（最大3秒）
      let waitCount = 0;
      const maxWait = 30; // 100ms x 30 = 3秒
      
      console.log('[useEffect] Waiting for authentication...');
      while ((!authStateRef.current.currentUser || !authStateRef.current.userProfile || !authStateRef.current.firebaseSynced) && waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      
      const { currentUser: authUser, userProfile: authProfile, firebaseSynced: authSynced } = authStateRef.current;
      console.log(`[useEffect] Auth ${authUser ? 'ready' : 'timeout'}, Profile ${authProfile ? 'ready' : 'timeout'}, Firebase ${authSynced ? 'synced' : 'not synced'} after ${waitCount * 100}ms`);
      
      try {
        const sortedGirls = await sortGirlsByPreference(
          sortedGirlsCache,
          authUser?.uid || '',
          userLocation,
          authProfile?.location || ''
        );
        setGirlsFromDB(sortedGirls);
        setSortedGirlsCache(sortedGirls);
        setHasInitialSort(true); // 初回ソート完了
        console.log(`✅ [useEffect] Initial sort completed ${authUser ? 'with user preferences' : 'with default order'}`);
      } catch (error) {
        console.error('Initial sort failed:', error);
        setGirlsFromDB(sortedGirlsCache);
        setHasInitialSort(true); // エラーでも完了扱い
      } finally {
        setIsSorting(false);
      }
    };
    
    performInitialSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedGirlsCache]); // データがキャッシュされたときに実行

  // 認証完了時にデータを再ソート（初回ソートが未認証だった場合のみ）
  useEffect(() => {
    // ソート中、または既に認証済みで初回ソートした場合、またはデータがない場合はスキップ
    if (isSorting || hasInitialSort || !sortedGirlsCache || sortedGirlsCache.length === 0) return;
    
    // 認証が完了し、プロフィールも取得された場合は再ソート
    if (currentUser && userProfile) {
      console.log('🔄 [useEffect] User authenticated with profile, re-sorting data...');
      const resortGirls = async () => {
        setIsSorting(true); // ソート開始
        try {
          const resortedGirls = await sortGirlsByPreference(
            sortedGirlsCache, // キャッシュされたデータを使用
            currentUser.uid,
            userLocation,
            userProfile.location || ''
          );
          setGirlsFromDB(resortedGirls);
          setSortedGirlsCache(resortedGirls);
          setHasInitialSort(true); // 認証済みソート完了フラグを立てる
          console.log('✅ [useEffect] Data re-sorted with user profile');
        } finally {
          setIsSorting(false); // ソート終了
        }
      };
      resortGirls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userProfile]); // currentUserとuserProfileの両方を監視
  
  // 位置情報が更新されたらデータを再ソート
  useEffect(() => {
    // ソート中の場合はスキップ（競合を防ぐ）
    if (isSorting) return;
    
    // キャッシュがある場合は再ソートのみ実行
    if (userLocation && sortedGirlsCache && sortedGirlsCache.length > 0) {
      console.log('📍 [useEffect] Location updated, re-sorting data...');
      const resortGirls = async () => {
        setIsSorting(true); // ソート開始
        try {
          const resortedGirls = await sortGirlsByPreference(
            sortedGirlsCache, // キャッシュされたデータを使用
            currentUser?.uid || '',
            userLocation,
            userProfile?.location
          );
          setGirlsFromDB(resortedGirls);
          setSortedGirlsCache(resortedGirls);
          console.log('✅ [useEffect] Data re-sorted with location');
        } finally {
          setIsSorting(false); // ソート終了
        }
      };
      resortGirls();
    } else if (userLocation && !loadingUsers && !initialFetchDone) {
      // 位置情報が取得できたら初回のみDBから取得（位置情報付きで）
      console.log('📍 Location available, fetching with distance sorting...');
      setInitialFetchDone(true);
      fetchGirlsFromMySQL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // APIのベースURL取得（fetchGirlsFromMySQL内で使用）
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // MySQLからの女の子データ取得（最適化版 - mysql-girls-fast + MySQL側ソート）
  const fetchGirlsFromMySQL = useCallback(async () => {
    const fetchStartTime = performance.now();
    console.log('🚀 [fetchGirlsFromMySQL] Starting optimized data fetch with server-side sorting...');
    console.log('[fetchGirlsFromMySQL] User location:', userLocation);
    
    try {
      // ユーザー設定を取得
      let malePreferences = null;
      if (currentUser?.uid) {
        try {
          malePreferences = await getMalePreferences(currentUser.uid);
          console.log('[fetchGirlsFromMySQL] User preferences loaded:', malePreferences ? 'yes' : 'no');
        } catch (error) {
          console.warn('[fetchGirlsFromMySQL] Could not load preferences:', error);
        }
      }
      
      // 位置情報を正規化（小数点3桁に丸める）
      const normalizedLocation = userLocation 
        ? roundLocation(userLocation.lat, userLocation.lng, 3)
        : null;
      
      // キャッシュキー用のパラメータ
      const params: Record<string, any> = {
        limit: 200,
        offset: 0,
      };
      
      if (normalizedLocation) {
        params.userLat = normalizedLocation.lat;
        params.userLng = normalizedLocation.lng;
      }
      
      // APIのURL構築
      let apiUrl = `${baseUrl}/api/mysql-girls-fast?limit=200&offset=0`;
      if (normalizedLocation) {
        apiUrl += `&userLat=${normalizedLocation.lat}&userLng=${normalizedLocation.lng}`;
        console.log(`🚀 [fetchGirlsFromMySQL] Using normalized location: lat=${normalizedLocation.lat}, lng=${normalizedLocation.lng}`);
      } else {
        // 位置情報がない場合、東京駅の座標をフォールバックとして使用
        // 東京駅: 緯度35.6812, 経度139.7671
        const tokyoLat = 35.6812;
        const tokyoLng = 139.7671;
        apiUrl += `&userLat=${tokyoLat}&userLng=${tokyoLng}`;
        console.log('📍 [fetchGirlsFromMySQL] 位置情報なし - 東京駅周辺の女の子をデフォルト表示');
        console.log(`🗺️ フォールバック座標: lat=${tokyoLat}, lng=${tokyoLng}`);
      }
      
      // ユーザー設定をURLパラメータに追加
      if (malePreferences) {
        // 撮影オプション
        if (malePreferences.recordingDuringPlay) {
          apiUrl += `&recordingDuringPlay=${encodeURIComponent(malePreferences.recordingDuringPlay)}`;
          params.recordingDuringPlay = malePreferences.recordingDuringPlay;
        }
        // S/Mマッチング
        if (malePreferences.isSadist) {
          apiUrl += `&isSadist=${encodeURIComponent(malePreferences.isSadist)}`;
          params.isSadist = malePreferences.isSadist;
        }
        if (malePreferences.isMasochist) {
          apiUrl += `&isMasochist=${encodeURIComponent(malePreferences.isMasochist)}`;
          params.isMasochist = malePreferences.isMasochist;
        }
        // コスプレとおもちゃの嗜好（1-5のスケール）
        if (malePreferences.cosplay !== undefined) {
          apiUrl += `&cosplayPreference=${malePreferences.cosplay}`;
          params.cosplayPreference = malePreferences.cosplay;
        }
        if (malePreferences.toyPlay !== undefined) {
          apiUrl += `&toyPlayPreference=${malePreferences.toyPlay}`;
          params.toyPlayPreference = malePreferences.toyPlay;
        }
        // イラマチオ、ごっくん、アナルプレイの嗜好（1-5のスケール）
        if (malePreferences.deepthroat !== undefined) {
          apiUrl += `&deepthroatPreference=${malePreferences.deepthroat}`;
          params.deepthroatPreference = malePreferences.deepthroat;
        }
        if (malePreferences.throating !== undefined) {
          apiUrl += `&throatingPreference=${malePreferences.throating}`;
          params.throatingPreference = malePreferences.throating;
        }
        if (malePreferences.analPlay !== undefined) {
          apiUrl += `&analPlayPreference=${malePreferences.analPlay}`;
          params.analPlayPreference = malePreferences.analPlay;
        }
        // 複数人プレイの嗜好（1-5のスケール）
        if (malePreferences.groupPlay !== undefined) {
          apiUrl += `&groupPlayPreference=${malePreferences.groupPlay}`;
          params.groupPlayPreference = malePreferences.groupPlay;
        }
        // 女の子タイプの嗜好（IDの配列）
        if (malePreferences.girlTypeIds && malePreferences.girlTypeIds.length > 0) {
          apiUrl += `&preferredGirlTypeIds=${malePreferences.girlTypeIds.join(',')}`;
          params.preferredGirlTypeIds = malePreferences.girlTypeIds;
        }
        // 相手の体型の嗜好（文字列の配列）
        if (malePreferences.partnerBodyTypes && malePreferences.partnerBodyTypes.length > 0) {
          apiUrl += `&preferredBodyTypes=${encodeURIComponent(malePreferences.partnerBodyTypes.join(','))}`;
          params.preferredBodyTypes = malePreferences.partnerBodyTypes;
        }
        // 年齢範囲
        if (malePreferences.partnerAgeMin !== undefined && malePreferences.partnerAgeMin !== null && !isNaN(malePreferences.partnerAgeMin)) {
          apiUrl += `&ageMin=${malePreferences.partnerAgeMin}`;
          params.ageMin = malePreferences.partnerAgeMin;
        }
        if (malePreferences.partnerAgeMax !== undefined && malePreferences.partnerAgeMax !== null && !isNaN(malePreferences.partnerAgeMax)) {
          apiUrl += `&ageMax=${malePreferences.partnerAgeMax}`;
          params.ageMax = malePreferences.partnerAgeMax;
        }
        // 身長・体重・居住地
        if (malePreferences.partnerHeight) {
          apiUrl += `&partnerHeight=${encodeURIComponent(malePreferences.partnerHeight)}`;
          params.partnerHeight = malePreferences.partnerHeight;
        }
        if (malePreferences.partnerWeight) {
          apiUrl += `&partnerWeight=${encodeURIComponent(malePreferences.partnerWeight)}`;
          params.partnerWeight = malePreferences.partnerWeight;
        }
        if (malePreferences.partnerLocation) {
          apiUrl += `&partnerLocation=${encodeURIComponent(malePreferences.partnerLocation)}`;
          params.partnerLocation = malePreferences.partnerLocation;
        }
      }
      
      console.log(`🚀 [fetchGirlsFromMySQL] API URL: ${apiUrl}`);
      
      // キャッシュキーを生成
      const cacheKey = generateCacheKey(params);
      
      // 重複排除機能付きでフェッチ
      const data = await fetchWithDedup(apiUrl, {
        method: 'GET',
        credentials: typeof window !== 'undefined' && window.navigator.userAgent.includes('Line') ? 'omit' : 'include',
        mode: 'cors',
      }, cacheKey);
      const fetchTime = performance.now() - fetchStartTime;
      
      console.log(`🚀 [fetchGirlsFromMySQL] API Response:`, {
        fetchTime: fetchTime.toFixed(0),
        apiResponseTime: data.performance?.responseTime || 0,
        cacheHitRate: data.performance?.cacheHitRate || 0,
        girls: data.girls?.length || 0,
        total: data.total || 0
      });
      
      if (data && data.girls && Array.isArray(data.girls) && data.girls.length > 0) {
        // データの前処理
        const girlsWithDetails = data.girls.map((girl: any) => ({
          ...girl,
          id: parseInt(girl.id),
          shop: girl.shop || {
            id: girl.shopId,
            name: girl.shopName,
            area_prefecture_id: girl.area_prefecture_id
          }
        }));
        
        // サーバー側でソート済みのため、クライアント側ソートは不要
        console.log(`⚡ [fetchGirlsFromMySQL] Data already sorted by server (distance-based)`);
        
        // 距離情報をログ出力（デバッグ用）
        if (userLocation && girlsWithDetails.length > 0) {
          const firstFive = girlsWithDetails.slice(0, 5);
          console.log('📍 Top 5 girls by distance:');
          firstFive.forEach((girl: any, idx: number) => {
            const distance = girl.distance_km;
            console.log(`  ${idx + 1}. ${girl.name}: ${distance ? distance.toFixed(1) + 'km' : 'N/A'}`);
          });
        }
        
        setGirlsFromDB(girlsWithDetails);
        setSortedGirlsCache(girlsWithDetails);
        setIsSorting(false);
        
        const totalTime = performance.now() - fetchStartTime;
        console.log(`✅ [fetchGirlsFromMySQL] Total processing time: ${totalTime.toFixed(0)}ms`);
        console.log(`✅ [fetchGirlsFromMySQL] Set ${girlsWithDetails.length} girls in ${totalTime.toFixed(0)}ms (server-side sorted)`);
      } else {
        console.log('[fetchGirlsFromMySQL] No data from API');
        setGirlsFromDB([]);
      }
    } catch (error) {
      console.error('Error fetching girls:', error);
      // エラー時も既存データを保持
    }
  }, [baseUrl, userLocation, currentUser]);

  const fetchUsers = useCallback(async () => {
    // LINEブラウザ対応: currentUserがなくてもデータを取得して表示
    console.log('[fetchUsers] Starting data fetch...');
    try {
      // LINEブラウザでも即座に表示するため、ローディングは表示しない
      // setLoadingUsers(true); // コメントアウト
      
      if (useFirebaseData) {
        // 共通関数を使用してFirebaseから管理者登録の女性ユーザーを取得（より多く取得）
        let fetchedUsers = await fetchAdminGirls(currentUser?.uid || '', 200);
        
        // 新しい優先順位ソート機能を使用
        // 1. GPS位置情報 → 2. プロフィール住所 → 3. 活動エリア の順で優先
        fetchedUsers = await sortUsersByPreference(
          fetchedUsers,
          currentUser?.uid || '',
          userLocation,
          userProfile?.location
        );
        
        // Firebaseから取得したデータを設定
        setUsers(fetchedUsers);
      } else {
        // MySQLから女の子データを取得
        await fetchGirlsFromMySQL();
      }
      console.log('[fetchUsers] Data fetch completed successfully');
    } catch (error) {
      console.error('[fetchUsers] Error fetching users:', error);
      // エラー時でも既存データを保持（LINEブラウザ対応）
      // setUsers([]); 
      // setGirlsFromDB([]); 
    } finally {
      console.log('[fetchUsers] Setting loadingUsers to false');
      setLoadingUsers(false);
    }
  }, [useFirebaseData, userLocation, userProfile, fetchGirlsFromMySQL, currentUser]);

  // 女の子タイプのマスターデータを取得
  useEffect(() => {
    const fetchGirlTypes = async () => {
      try {
        const response = await fetch('/api/girl-types');
        if (response.ok) {
          const data = await response.json();
          setGirlTypes(data.allTypes || []);
        }
      } catch (error) {
        console.error('Error fetching girl types:', error);
      }
    };
    fetchGirlTypes();
  }, []);

  // LINEブラウザ対応: 位置情報取得後にデータ取得
  useEffect(() => {
    if (!initialFetchDone && userLocation) {
      console.log('[useEffect] Starting initial data fetch with location...');
      setInitialFetchDone(true);
      
      // ブラウザ判定
      if (isLineBrowser) {
        console.log('📱 LINE browser detected - using optimized fetch');
      }
      
      // fetchGirlsFromMySQLを使用（重複排除機能付き）
      fetchGirlsFromMySQL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, initialFetchDone, fetchGirlsFromMySQL]); // 位置情報が取得されたら実行


  // 認証状態に関係なくページを表示 - LINEブラウザ対応

  // search/advancedと同様、ローディング表示を削除
  // 即座にコンテンツを表示

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
  
  // LINEブラウザ対応: ローディング表示を完全に削除！
  // if (loadingUsers && displayData.length === 0) {
  //   return (
  //     <div className="flex justify-center items-center h-screen bg-white dark:bg-black">
  //       <Loader2 className="h-8 w-8 animate-spin text-primary" />
  //       <p className="ml-2 text-gray-900 dark:text-white">プロフィールを読み込み中...</p>
  //     </div>
  //   );
  // }
  
  // LINEブラウザ対応: データが空でもページを表示
  // loadingUsersに関係なく常にページを表示

  // Apply type filter and sort to all data
  const filteredAndSortedData = displayData
    .filter((item: any) => {
      // Apply keyword filter
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        const name = item.name?.toLowerCase() || '';
        const bio = (item.bio || item.pr_message || '').toLowerCase();
        const interests = (item.interests || []).join(' ').toLowerCase();
        const girlTypesText = (item.girlTypes || []).map((t: any) => typeof t === 'object' ? t.name : t).join(' ').toLowerCase();
        const playTypes = (item.play_types || []).join(' ').toLowerCase();
        const options = (item.options || []).join(' ').toLowerCase();
        const tags = (item.tags || []).join(' ').toLowerCase();
        
        // Check all fields for keyword
        const matchesKeyword = name.includes(keyword) ||
               bio.includes(keyword) ||
               interests.includes(keyword) ||
               girlTypesText.includes(keyword) ||
               playTypes.includes(keyword) ||
               options.includes(keyword) ||
               tags.includes(keyword);
        
        if (!matchesKeyword) return false;
      }
      
      // Apply girl type filter
      if (selectedGirlTypes.length > 0) {
        // girlTypesフィールドの構造を確認
        if (!item.girlTypes || !Array.isArray(item.girlTypes)) {
          return false;
        }
        
        // girlTypesの各要素からIDを抽出（オブジェクトまたは数値の両方に対応）
        const itemGirlTypeIds = item.girlTypes.map((type: any) => {
          if (typeof type === 'object' && type !== null) {
            // オブジェクトの場合、idフィールドを取得
            return type.id || type.girl_type_id || null;
          } else if (typeof type === 'number') {
            // 数値の場合、そのまま使用
            return type;
          } else {
            return null;
          }
        }).filter((id: any) => id !== null);
        
        // Check if item has at least one of the selected types
        const hasSelectedType = selectedGirlTypes.some(typeId => 
          itemGirlTypeIds.includes(typeId)
        );
        
        if (!hasSelectedType) return false;
      }
      
      return true;
    })
    .sort((a: any, b: any) => {
      // 【最優先】距離でソート（近い順）
      const distA = a.distance_km !== undefined ? a.distance_km : 999999;
      const distB = b.distance_km !== undefined ? b.distance_km : 999999;
      
      // 距離が大きく異なる場合（5km以上の差）は距離を優先
      if (Math.abs(distA - distB) > 5) {
        return distA - distB;
      }
      
      // 距離が近い場合（5km以内の差）、好みの条件でソート
      
      // 女の子タイプのマッチ数を計算
      if (selectedGirlTypes.length > 0) {
        const getTypeMatchScore = (item: any) => {
          if (!item.girlTypes || !Array.isArray(item.girlTypes)) {
            return 0;
          }
          
          const itemGirlTypeIds = item.girlTypes.map((type: any) => {
            if (typeof type === 'object' && type !== null) {
              return type.id || type.girl_type_id || null;
            } else if (typeof type === 'number') {
              return type;
            }
            return null;
          }).filter((id: any) => id !== null);
          
          // Count how many selected types this item has
          const matchCount = selectedGirlTypes.filter(typeId => 
            itemGirlTypeIds.includes(typeId)
          ).length;
          
          return matchCount;
        };
        
        const scoreA = getTypeMatchScore(a);
        const scoreB = getTypeMatchScore(b);
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // More matches = higher priority
        }
      }
      
      // 検索キーワードの関連度でソート
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        
        // Calculate relevance score for each item
        const getRelevanceScore = (item: any) => {
          let score = 0;
          const name = item.name?.toLowerCase() || '';
          const girlTypesText = (item.girlTypes || []).map((t: any) => typeof t === 'object' ? t.name : t).join(' ').toLowerCase();
          const playTypes = (item.play_types || []).join(' ').toLowerCase();
          
          // Higher score for exact matches in important fields
          if (name.includes(keyword)) score += 10;
          if (girlTypesText.includes(keyword)) score += 8;
          if (playTypes.includes(keyword)) score += 6;
          
          return score;
        };
        
        const scoreA = getRelevanceScore(a);
        const scoreB = getRelevanceScore(b);
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Sort by descending score
        }
      }
      
      // 最終的に同じ場合は距離の細かい差でソート
      return distA - distB;
    });

  // Calculate pagination based on filtered data
  const totalPages = Math.ceil(filteredAndSortedData.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const currentDisplayData = filteredAndSortedData.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // スマホ対応のスクロール処理
      setTimeout(() => {
        // iOS Safariを含むモバイルブラウザで確実に動作
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0; // iOS Safari用のフォールバック
        // 追加の保険として、html要素にもスクロール
        if ('scrollBehavior' in document.documentElement.style) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      }, 100); // 少し遅延を入れて、DOMの更新後にスクロール
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      // スマホ対応のスクロール処理
      setTimeout(() => {
        // iOS Safariを含むモバイルブラウザで確実に動作
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0; // iOS Safari用のフォールバック
        // 追加の保険として、html要素にもスクロール
        if ('scrollBehavior' in document.documentElement.style) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      }, 100); // 少し遅延を入れて、DOMの更新後にスクロール
    }
  };

  return (
    <div className="w-full bg-white dark:bg-black" style={{ minHeight: '100vh' }}>
      {/* Trial Banner */}
      <TrialBanner />
      
      {/* Banner Image */}
      <div className="w-full">
        <div className="relative h-32 sm:h-40 md:h-64 lg:h-80 xl:h-96">
          <a 
            href="https://fuzoku.sod.co.jp/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            <Image 
              src="/img/sod.webp" 
              alt="Nukune Banner" 
              fill
              className="object-contain"
              priority
            />
          </a>
        </div>
      </div>
      
      <div className="px-4 pb-6">
        {/* Search and View mode controls */}
        <div className="flex justify-between items-center mb-4">
          {/* Type filter or keyword search */}
          <div className="flex-1 mr-2">
            {showTypeFilter ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-white">女の子タイプで絞り込み</span>
                  <div className="flex gap-2">
                    {selectedGirlTypes.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedGirlTypes([]);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        クリア
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowTypeFilter(false);
                        // バツボタンはパネルを閉じるだけ（選択は維持）
                      }}
                      className="hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {girlTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedGirlTypes(prev => 
                          prev.includes(type.id) 
                            ? prev.filter(id => id !== type.id)
                            : [...prev, type.id]
                        );
                        // 選択と同時に即座にフィルタリングが適用される（useEffectで自動処理）
                      }}
                      className={`px-3 py-1 rounded-full text-xs transition-all ${
                        selectedGirlTypes.includes(type.id)
                          ? 'bg-pink-500 text-white border border-pink-500'
                          : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
                {selectedGirlTypes.length > 0 && (
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {selectedGirlTypes.length}個のタイプを選択中
                    </span>
                    <span className="text-xs text-pink-400">
                      ※選択したタイプが上位に表示されます
                    </span>
                  </div>
                )}
              </div>
            ) : showSearchInput ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="キーワード検索（名前、メッセージなど）"
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
                  className="hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTypeFilter(true)}
                  className={`hover:bg-gray-700 hover:text-white px-4 py-2 ${
                    selectedGirlTypes.length > 0 
                      ? 'bg-pink-500/20 border-pink-500 text-pink-400' 
                      : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  <span className="text-sm">絞り込み</span>
                  {selectedGirlTypes.length > 0 && (
                    <span className="ml-1 text-sm">({selectedGirlTypes.length})</span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearchInput(true)}
                  className="bg-gray-800 border-gray-700 hover:text-white hover:bg-gray-700 px-3 py-1.5"
                  title="キーワード検索"
                >
                  <Search className="w-4 h-4" />
                </Button>
                {(searchKeyword || selectedGirlTypes.length > 0) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchKeyword('');
                      setSelectedGirlTypes([]);
                    }}
                    className="hover:text-white"
                    title="フィルターをクリア"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            
            {/* 嗜好設定スライダー - 全設定項目を含む拡張版 */}
            {preferences && (
              <div ref={preferencePanelRef} className="bg-gray-900 rounded-lg p-4 space-y-4 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">あなたの嗜好を調整</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPreferenceSliders(!showPreferenceSliders)}
                    className="text-xs bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {showPreferenceSliders ? '非表示' : '表示'}
                  </Button>
                </div>
                
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  showPreferenceSliders ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="space-y-6 pt-2">
                    {/* セクション1: 相手の基本条件 */}
                    <div className="border-b border-gray-800 pb-4">
                      <h3 className="text-sm font-semibold text-pink-400 mb-3">相手の基本条件</h3>
                      
                      {/* 年齢範囲 */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs text-gray-400">最小年齢</Label>
                          <Select 
                            value={preferences.partnerAgeMin?.toString()} 
                            onValueChange={(value) => savePreferenceScore('partnerAgeMin', parseInt(value))}
                          >
                            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                                <SelectItem key={age} value={age.toString()}>{age}歳</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400">最大年齢</Label>
                          <Select 
                            value={preferences.partnerAgeMax?.toString()} 
                            onValueChange={(value) => savePreferenceScore('partnerAgeMax', parseInt(value))}
                          >
                            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                                <SelectItem key={age} value={age.toString()}>{age}歳</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* 身長 */}
                      <div className="mb-3">
                        <Label className="text-xs text-gray-400">相手の身長</Label>
                        <Select 
                          value={preferences.partnerHeight} 
                          onValueChange={(value) => savePreferenceString('partnerHeight', value)}
                        >
                          <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="こだわらない">こだわらない</SelectItem>
                            <SelectItem value="140cm～150cm">140cm～150cm</SelectItem>
                            <SelectItem value="150cm～155cm">150cm～155cm</SelectItem>
                            <SelectItem value="155cm～160cm">155cm～160cm</SelectItem>
                            <SelectItem value="160cm～165cm">160cm～165cm</SelectItem>
                            <SelectItem value="165cm～170cm">165cm～170cm</SelectItem>
                            <SelectItem value="170cm～175cm">170cm～175cm</SelectItem>
                            <SelectItem value="175cm～180cm">175cm～180cm</SelectItem>
                            <SelectItem value="180cm以上">180cm以上</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 体重 */}
                      <div className="mb-3">
                        <Label className="text-xs text-gray-400">相手の体重</Label>
                        <Select 
                          value={preferences.partnerWeight} 
                          onValueChange={(value) => savePreferenceString('partnerWeight', value)}
                        >
                          <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="こだわらない">こだわらない</SelectItem>
                            <SelectItem value="40kg以下">40kg以下</SelectItem>
                            <SelectItem value="40kg～45kg">40kg～45kg</SelectItem>
                            <SelectItem value="45kg～50kg">45kg～50kg</SelectItem>
                            <SelectItem value="50kg～55kg">50kg～55kg</SelectItem>
                            <SelectItem value="55kg～60kg">55kg～60kg</SelectItem>
                            <SelectItem value="60kg～65kg">60kg～65kg</SelectItem>
                            <SelectItem value="65kg～70kg">65kg～70kg</SelectItem>
                            <SelectItem value="70kg以上">70kg以上</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 居住地 */}
                      <div className="mb-3">
                        <Label className="text-xs text-gray-400">相手の居住地</Label>
                        <Select 
                          value={preferences.partnerLocation} 
                          onValueChange={(value) => savePreferenceString('partnerLocation', value)}
                        >
                          <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                            <SelectItem value="こだわらない">こだわらない</SelectItem>
                            <SelectItem value="東京都">東京都</SelectItem>
                            <SelectItem value="神奈川県">神奈川県</SelectItem>
                            <SelectItem value="大阪府">大阪府</SelectItem>
                            <SelectItem value="愛知県">愛知県</SelectItem>
                            <SelectItem value="埼玉県">埼玉県</SelectItem>
                            <SelectItem value="千葉県">千葉県</SelectItem>
                            <SelectItem value="兵庫県">兵庫県</SelectItem>
                            <SelectItem value="北海道">北海道</SelectItem>
                            <SelectItem value="福岡県">福岡県</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* セクション2: 相手の体型 */}
                    <div className="border-b border-gray-800 pb-4">
                      <h3 className="text-sm font-semibold text-pink-400 mb-3">相手の体型</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {['スリム', 'やや細め', '細め', 'グラマー', '筋肉質', 'ややぽっちゃり', 'ぽっちゃり', 'こだわらない'].map((bodyType) => (
                          <div 
                            key={bodyType} 
                            className="flex items-center space-x-2 p-2 border border-gray-700 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
                            onClick={() => {
                              const isChecked = preferences.partnerBodyTypes?.includes(bodyType) || false;
                              if (!isChecked) {
                                savePreferenceArray('partnerBodyTypes', [...(preferences.partnerBodyTypes || []), bodyType]);
                              } else {
                                savePreferenceArray('partnerBodyTypes', (preferences.partnerBodyTypes || []).filter(t => t !== bodyType));
                              }
                            }}
                          >
                            <Checkbox
                              checked={preferences.partnerBodyTypes?.includes(bodyType) || false}
                              className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                            />
                            <Label className="text-xs cursor-pointer text-gray-200">{bodyType}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* セクション3: 女の子タイプ */}
                    {girlTypes.length > 0 && (
                      <div className="border-b border-gray-800 pb-4">
                        <h3 className="text-sm font-semibold text-pink-400 mb-3">女の子タイプ</h3>
                        
                        {/* 性格タイプ */}
                        <div className="mb-3">
                          <h4 className="text-xs text-gray-400 mb-2">性格タイプ</h4>
                          <div className="grid grid-cols-3 gap-1">
                            {girlTypes.filter((type: any) => type.class_id === 1).map((girlType: any) => (
                              <div 
                                key={girlType.id} 
                                className="flex items-center space-x-1 p-1 border border-gray-700 bg-gray-800 rounded text-xs cursor-pointer hover:bg-gray-700"
                                onClick={() => {
                                  const isChecked = preferences.girlTypeIds?.includes(girlType.id) || false;
                                  if (!isChecked) {
                                    savePreferenceArray('girlTypeIds', [...(preferences.girlTypeIds || []), girlType.id]);
                                  } else {
                                    savePreferenceArray('girlTypeIds', (preferences.girlTypeIds || []).filter(id => id !== girlType.id));
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={preferences.girlTypeIds?.includes(girlType.id) || false}
                                  className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500 h-3 w-3"
                                />
                                <Label className="text-xs cursor-pointer text-gray-200">{girlType.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 身体的特徴 */}
                        <div className="mb-3">
                          <h4 className="text-xs text-gray-400 mb-2">身体的特徴</h4>
                          <div className="grid grid-cols-3 gap-1">
                            {girlTypes.filter((type: any) => type.class_id === 2).map((girlType: any) => (
                              <div 
                                key={girlType.id} 
                                className="flex items-center space-x-1 p-1 border border-gray-700 bg-gray-800 rounded text-xs cursor-pointer hover:bg-gray-700"
                                onClick={() => {
                                  const isChecked = preferences.girlTypeIds?.includes(girlType.id) || false;
                                  if (!isChecked) {
                                    savePreferenceArray('girlTypeIds', [...(preferences.girlTypeIds || []), girlType.id]);
                                  } else {
                                    savePreferenceArray('girlTypeIds', (preferences.girlTypeIds || []).filter(id => id !== girlType.id));
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={preferences.girlTypeIds?.includes(girlType.id) || false}
                                  className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500 h-3 w-3"
                                />
                                <Label className="text-xs cursor-pointer text-gray-200">{girlType.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* セクション4: プレイスタイル */}
                    <div className="border-b border-gray-800 pb-4">
                      <h3 className="text-sm font-semibold text-pink-400 mb-3">プレイスタイル</h3>
                      
                      <div className="grid grid-cols-1 gap-3 mb-3">
                        <div>
                          <Label className="text-xs text-gray-400">プレイ時の撮影</Label>
                          <Select 
                            value={preferences.recordingDuringPlay} 
                            onValueChange={(value) => savePreferenceString('recordingDuringPlay', value)}
                          >
                            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="しない">しない</SelectItem>
                              <SelectItem value="したい">したい</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-400">あなたはSですか？</Label>
                          <Select 
                            value={preferences.isSadist} 
                            onValueChange={(value) => savePreferenceString('isSadist', value)}
                          >
                            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="はい">はい</SelectItem>
                              <SelectItem value="いいえ">いいえ</SelectItem>
                              <SelectItem value="わからない">わからない</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-400">あなたはMですか？</Label>
                          <Select 
                            value={preferences.isMasochist} 
                            onValueChange={(value) => savePreferenceString('isMasochist', value)}
                          >
                            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white text-xs">
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="はい">はい</SelectItem>
                              <SelectItem value="いいえ">いいえ</SelectItem>
                              <SelectItem value="わからない">わからない</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* セクション5: セクシュアル嗜好 */}
                    <div>
                      <h3 className="text-sm font-semibold text-pink-400 mb-3">セクシュアル嗜好</h3>
                      <div className="space-y-3">
                        {[
                          { key: 'groupPlay', label: '複数プレイ', value: preferences.groupPlay },
                          { key: 'throating', label: 'ゴックン', value: preferences.throating },
                          { key: 'analPlay', label: 'アナル', value: preferences.analPlay },
                          { key: 'cosplay', label: 'コスプレ', value: preferences.cosplay },
                          { key: 'toyPlay', label: 'おもちゃ', value: preferences.toyPlay },
                          { key: 'deepthroat', label: 'イラマチオ', value: preferences.deepthroat }
                        ].map((pref) => (
                          <div key={pref.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">{pref.label}</span>
                              <span className="text-xs text-pink-400 font-medium">{pref.value}</span>
                            </div>
                            <Slider
                              value={[pref.value]}
                              onValueChange={(values) => savePreferenceScore(pref.key as keyof MalePreferences, values[0])}
                              min={1}
                              max={5}
                              step={1}
                              className="w-full"
                              disabled={savingPreferences}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {savingPreferences && (
                      <div className="text-xs text-center text-gray-500">
                        <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                        保存中...
                      </div>
                    )}
                  </div>
                </div>
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
                  : 'hover:text-white'
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
                  : 'hover:text-white'
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
          
          // サーバーから返された距離を使用（既に計算済み）
          let distance: number | null = null;
          
          // distance_kmフィールドがある場合はそれを使用
          if (item.distance_km !== undefined && item.distance_km < 999999) {
            distance = item.distance_km;
            // console.log(`Distance for ${item.name}: ${distance}km`); // デバッグ用
          }
          // フォールバック：クライアント側で計算（互換性のため）
          else if (userLocation && item.shop?.latitude && item.shop?.longitude) {
            const R = 6371; // Earth radius in km
            const dLat = (item.shop.latitude - userLocation.lat) * Math.PI / 180;
            const dLon = (item.shop.longitude - userLocation.lng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(item.shop.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
            console.log(`Calculated distance for ${item.name}: ${distance}km`); // デバッグ用
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
                  className={`object-contain transition-transform duration-300 hover:scale-105 ${!hasPremium && !subscriptionLoading ? 'blur-image' : ''}`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                {!hasPremium && !subscriptionLoading && (
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
                } sm:text-sm mb-2`}>
                  <span>{age ? `${age}歳` : '不明'}</span>
                  <span>•</span>
                  <span>{location}</span>
                  {distance !== null && distance < 999999 && (
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
                  } sm:text-sm mb-3`}>
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
                  {girlTypes.slice(0, 3).map((type: any, index: number) => {
                    const typeName = typeof type === 'object' ? type.name : type;
                    const typeId = typeof type === 'object' ? type.id : index;
                    return (
                      <span 
                        key={`type-${typeId}`} 
                        className="px-3 py-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/40 rounded-full text-xs text-pink-300 font-medium"
                      >
                        ✨ {typeName}
                      </span>
                    );
                  })}
                  
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
                    <span className="px-3 py-1 bg-gray-500/10 border border-gray-500/30 rounded-full text-xs">
                      {is_tobacco ? '🚬 タバコOK' : '🚫 タバコNG'}
                    </span>
                  )}
                </div>
                
                {/* Bio */}
                {bio && (
                  <p className={`${
                    viewMode === 'single' ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'
                  } sm:text-sm mb-4 flex-1`}>
                    {bio}
                  </p>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="outline"
                    className={`flex-1 min-w-0 bg-[#8B1E3F]/20 text-[#8B1E3F] border-[#8B1E3F] hover:bg-[#8B1E3F] hover:text-white hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis ${
                      viewMode === 'single' ? 'text-sm px-4 py-2' : 'text-xs px-2 py-1.5'
                    } sm:text-sm`}
                    disabled={likingStates[`mysql_girl_${item.id}`]}
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
                      if (!hasPremium && !subscriptionLoading) {
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
                      
                      // 楽観的更新でいいねを送信（高速化）
                      const targetId = `mysql_girl_${item.id}`;
                      handleLikeOptimistic(
                        currentUser.uid,
                        targetId,
                        name,
                        {
                          toGirlName: name,
                          toGirlId: item.id,
                          isGirlProfile: true
                        }
                      ).catch(error => {
                        console.error('Like error:', error);
                      });
                    }}
                  >
                    {likingStates[`mysql_girl_${item.id}`] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        いいね
                      </>
                    )}
                  </Button>
                  <Button
                    className={`flex-1 min-w-0 bg-pink-500 text-white hover:bg-pink-600 hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis ${
                      viewMode === 'single' ? 'text-sm px-4 py-2' : 'text-xs px-2 py-1.5'
                    } sm:text-sm`}
                    disabled={navigatingStates[item.id]}
                    onMouseEnter={() => prefetchMemoPage(item.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      // ログインチェック
                      if (!currentUser) {
                        toast({
                          title: 'ログインが必要です',
                          description: 'メモを使うにはログインしてください',
                          variant: 'destructive'
                        });
                        router.push('/login');
                        return;
                      }
                      
                      // 有料会員チェック
                      if (!hasPremium && !subscriptionLoading) {
                        toast({
                          title: '有料会員限定',
                          description: 'メモ機能を使うには有料会員登録が必要です',
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
                      
                      // 高速ナビゲーション（プリフェッチ済み）
                      handleMemoNavigation(item.id, name);
                    }}
                  >
                    {navigatingStates[item.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        移動中...
                      </>
                    ) : (
                      <>
                        <StickyNote className="w-4 h-4" />
                        メモ
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredAndSortedData.length === 0 && searchKeyword && (
        <div className="text-center py-10">
          <p className="text-xl mb-4 text-white">「{searchKeyword}」に一致する女の子が見つかりません</p>
          <Button onClick={() => setSearchKeyword('')} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> 検索をクリア
          </Button>
        </div>
      )}
      
      {displayData.length === 0 && !searchKeyword && (
        <div className="text-center py-10">
          <p className="text-xl mb-4 text-white">データを読み込み中...</p>
          <p className="text-sm mb-4">しばらくお待ちください</p>
          <Button onClick={() => {
            console.log('Manual reload triggered');
            setLoadingUsers(true);
            fetchUsers().finally(() => setLoadingUsers(false));
          }} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> 今すぐ再読み込み
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
        <div className="text-center mt-4">
          <p>「{searchKeyword}」の検索結果: {filteredAndSortedData.length}名</p>
        </div>
      )}
      
      {/* Footer Logo */}
      <div className="w-full">
        <div className="relative h-32 sm:h-40 md:h-64 lg:h-80 xl:h-96">
          <a 
            href="https://keishinkai-grp.or.jp/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            <Image 
              src="/img/sodland.webp" 
              alt="KEISHINKAI Logo" 
              fill
              className="object-contain"
            />
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
