"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GirlWithDetails } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Ruler, Heart, ChevronLeft, ChevronRight, Navigation, StickyNote, ExternalLink } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import PremiumOnlyCard from '@/components/PremiumOnlyCard';
import { toast } from '@/hooks/use-toast';
import { getPremiumMessage } from '@/config/premium-messages';
import Image from 'next/image';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import '@/styles/blur.css';
import { getCurrentLocation, type LocationCoordinates } from '@/lib/utils/location';
import { getLocationCoordinates } from '@/lib/utils/japanLocations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GirlProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { hasPremium: isPremium, isLoading: subscriptionLoading } = useSubscription();
  const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [girl, setGirl] = useState<GirlWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessingLike, setIsProcessingLike] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // 無料ユーザーのアクセスチェック
  useEffect(() => {
    // サブスクリプションローディング中は待つ
    if (subscriptionLoading) return;
    
    // 無料ユーザーの場合はアクセス拒否
    if (!isPremium) {
      setShowAccessDenied(true);
      setLoading(false);
      return;
    }
  }, [isPremium, subscriptionLoading]);

  useEffect(() => {
    const fetchGirlDetails = async () => {
      // 無料ユーザーはデータ取得しない
      if (!isPremium && !subscriptionLoading) {
        return;
      }
      
      try {
        const response = await fetch(`/api/girls/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setGirl(data);
          
          // Calculate distance if user location is available
          if (userLocation && data) {
            calculateDistance(data, userLocation);
          }
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };

    if (params.id && isPremium) {
      fetchGirlDetails();
    }
  }, [params.id, userLocation, isPremium, subscriptionLoading]);
  
  // Get user location on mount（高速化：住所取得をスキップ）
  useEffect(() => {
    const getLocation = async () => {
      try {
        const locationInfo = await getCurrentLocation(true); // 住所取得をスキップして高速化
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates);
        }
      } catch (error) {
        // Silently handle location errors
      }
    };
    
    getLocation();
  }, []);
  
  // Calculate distance function
  const calculateDistance = (girlData: GirlWithDetails, userLoc: LocationCoordinates) => {
    let shopLat: number | null = null;
    let shopLng: number | null = null;
    
    // Try to get coordinates from shop
    if (girlData.shop?.latitude && girlData.shop?.longitude) {
      shopLat = girlData.shop.latitude;
      shopLng = girlData.shop.longitude;
    } else if (girlData.location) {
      // Use approximate coordinates based on location
      const coords = getLocationCoordinates(girlData.location);
      if (coords) {
        shopLat = coords.lat;
        shopLng = coords.lng;
      }
    }
    
    if (shopLat && shopLng) {
      // Calculate distance using Haversine formula
      const R = 6371; // Earth radius in km
      const dLat = (shopLat - userLoc.lat) * Math.PI / 180;
      const dLon = (shopLng - userLoc.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(shopLat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const calculatedDistance = R * c;
      setDistance(calculatedDistance);
    }
  };

  /**
   * 予約サイトへの遷移URLを生成
   * - MySQLの都道府県ID(area_prefecture_id)と地方ID(area_large_id)を使用し、
   *   ID/名称/地方の整合性を全国で保証する
   */
  const generateReservationUrl = () => {
    if (!girl) return '';
    
    const baseUrl = process.env.NEXT_PUBLIC_RESERVATION_SITE_URL || 'https://stg.nukipedia.jp';
    
    // 地方ID -> 地方名/ID のマッピング（DBの定義に合わせる想定）
    const regionMap: Record<number, { name: string; id: string }> = {
      // DBの area_larges に準拠
      1: { name: '北海道', id: '1' },
      2: { name: '東北', id: '2' },
      3: { name: '関東', id: '3' },
      4: { name: '北陸・甲信越', id: '4' },
      5: { name: '東海', id: '5' },
      6: { name: '関西', id: '6' },
      7: { name: '中国', id: '7' },
      8: { name: '四国', id: '8' },
      9: { name: '九州・沖縄', id: '9' }
    };

    // 都道府県/地方の決定（MySQLのコードを最優先）
    const fromPrefectureId = girl.shop?.area_prefecture_id
      ? girl.shop.area_prefecture_id.toString()
      : undefined;
    const fromPrefecture = girl.prefectureName || undefined;

    const guessedRegion = girl.areaLargeId && regionMap[girl.areaLargeId]
      ? regionMap[girl.areaLargeId]
      : undefined;
    const fromRegion = guessedRegion?.name || '関東';
    const fromRegionId = guessedRegion?.id || '3';
    
    const params = new URLSearchParams({
      shopId: girl.shop_profile_id.toString(),
      girlId: girl.id.toString(),
      fromRegion: fromRegion,
      fromRegionId: fromRegionId,
      // DB由来の名称/IDを優先（存在しない場合は送信しない）
      ...(fromPrefecture ? { fromPrefecture } : {}),
      ...(fromPrefectureId ? { fromPrefectureId } : {}),
      fromGenre: 'デリヘル,ホテヘル,ヘルス,ソープ,風俗エステ,その他',
      fromSearchType: 'search'
    });
    
    return `${baseUrl}/reservation/course?${params.toString()}`;
  };

  const handleReservation = () => {
    setShowReservationDialog(true);
  };

  const confirmReservation = async () => {
    if (!girl) {
      console.error('Girl data is not available');
      return;
    }

    if (!currentUser || !isAuthenticated) {
      toast({
        title: "ログインが必要です",
        description: "リクエストを送るにはログインしてください。",
        variant: "destructive",
      });
      router.push('/login');
      return;
    }

    // 先にダイアログを閉じる
    setShowReservationDialog(false);
    
    // 外部サイトへ遷移
    const reservationUrl = generateReservationUrl();
    console.log('🔗 Opening reservation URL:', reservationUrl);
    window.open(reservationUrl, '_blank');

    // Firestoreに直接リクエストを保存（クライアント側）
    try {
      console.log('📤 Saving request to Firestore...');
      
      // LINEブラウザの場合、Firebase初期化を待つ
      let currentDb = db;
      
      if (isLineBrowser || !db) {
        console.log('[confirmReservation] Waiting for Firebase initialization...');
        const { waitForFirebaseInLine } = await import('@/lib/firebase/line-auth-helper');
        const initialized = await waitForFirebaseInLine();
        
        if (!initialized) {
          console.error('Firebase initialization failed');
          return;
        }
        
        const { getFirebaseDb } = await import('@/lib/firebase/client');
        currentDb = getFirebaseDb();
        
        if (!currentDb) {
          console.error('Database not available');
          return;
        }
      }
      
      if (!currentDb) {
        console.error('Database not available');
        return;
      }

      // リクエストデータを作成
      const requestData = {
        userId: currentUser.uid,
        girlId: `mysql_girl_${girl.id}`,
        girlName: girl.name || '',
        shopId: girl.shop_profile_id || null,
        shopName: girl.shop?.name || '',
        createdAt: Timestamp.now(),
        status: 'pending',
        type: 'reservation'
      };

      // Firestoreにリクエストを保存
      const requestsRef = collection(currentDb, 'requests');
      const requestDoc = await addDoc(requestsRef, requestData);
      console.log('✅ Request saved with ID:', requestDoc.id);

      // ユーザーのstatsを更新（リクエスト数を増やす）
      const userStatsRef = doc(currentDb, 'userStats', currentUser.uid);
      const statsDoc = await getDoc(userStatsRef);
      
      if (statsDoc.exists()) {
        console.log('📊 Updating existing user stats...');
        await updateDoc(userStatsRef, {
          requestsSent: increment(1),
          updatedAt: Timestamp.now()
        });
      } else {
        console.log('📊 Creating new user stats...');
        await setDoc(userStatsRef, {
          requestsSent: 1,
          requestsReceived: 0,
          likesReceived: 0,
          likesSent: 0,
          matchesCount: 0,
          updatedAt: Timestamp.now()
        });
      }

      console.log('✅ Request counted successfully');
      
      // トースト通知を表示
      toast({
        title: "リクエスト送信完了",
        description: `${girl.name}さんへのリクエストを記録しました`,
      });
      
    } catch (error) {
      console.error('❌ Error saving request:', error);
      // エラーでもユーザー体験を損なわないよう、成功メッセージを表示
      toast({
        title: "予約ページへ移動しました",
        description: `${girl.name}さんの予約ページを開きました`,
      });
    }
  };

  const handleLike = useCallback(async () => {
    if (!girl || isProcessingLike) return;
    
    if (!currentUser || !isAuthenticated) {
      toast({
        title: "ログインが必要です",
        description: "いいねを送るにはログインしてください。",
        variant: "destructive",
      });
      router.push('/login');
      return;
    }

    // 有料会員チェック
    if (!subscriptionLoading && !isPremium) {
      toast({
        title: "有料会員限定",
        description: "いいねを送るには有料会員登録が必要です。",
        variant: "destructive",
      });
      router.push('/subscription');
      return;
    }

    // LINEブラウザの場合、Firebase初期化を待つ
    const isLineBrowser = typeof window !== 'undefined' && 
      window.navigator.userAgent.toLowerCase().includes('line');
    
    let currentDb = db;
    
    if (isLineBrowser || !db) {
      console.log('[handleLike] Waiting for Firebase initialization...');
      const { waitForFirebaseInLine } = await import('@/lib/firebase/line-auth-helper');
      const initialized = await waitForFirebaseInLine();
      
      if (!initialized) {
        toast({
          title: "エラー",
          description: "Firebaseの初期化に失敗しました。ページを再読み込みしてください。",
          variant: "destructive",
        });
        return;
      }
      
      // Firebaseが初期化された後、dbを再取得
      const { getFirebaseDb } = await import('@/lib/firebase/client');
      currentDb = getFirebaseDb();
      
      if (!currentDb) {
        toast({
          title: "エラー",
          description: "データベースに接続できません。",
          variant: "destructive",
        });
        return;
      }
    }
    
    // currentDbがnullでないことを保証
    if (!currentDb) {
      toast({
        title: "エラー",
        description: "データベースに接続できません。",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingLike(true);
    try {
      // Create a unique identifier for MySQL girls
      const mysqlGirlId = `mysql_girl_${girl.id}`;
      
      // Check if like already exists
      const likesRef = collection(currentDb, 'likes');
      const q = firestoreQuery(
        likesRef,
        where('from', '==', currentUser.uid),
        where('to', '==', mysqlGirlId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast({
          title: "すでにいいねを送っています",
          description: "この女性にはすでにいいねを送信済みです。",
        });
        return;
      }

      // Create the like document
      await addDoc(likesRef, {
        from: currentUser.uid,
        to: mysqlGirlId,
        toGirlName: girl.name,
        toGirlId: girl.id,
        isGirlProfile: true, // Flag to indicate this is a MySQL girl profile
        createdAt: Timestamp.now(),
        seen: false
      });

      toast({
        title: "いいねを送りました！",
        description: `${girl.name}さんにいいねを送信しました。`,
      });
      
    } catch (error) {
      toast({
        title: "エラーが発生しました",
        description: "いいねの送信に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsProcessingLike(false);
    }
  }, [currentUser, girl, isProcessingLike, isAuthenticated, router, isPremium, subscriptionLoading]);

  // 無料ユーザーにアクセス拒否メッセージを表示
  if (showAccessDenied && !isPremium && !subscriptionLoading) {
    return (
      <div className="bg-white dark:bg-black" style={{ minHeight: '100vh' }}>
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">プロフィール</h1>
          </div>
          
          <PremiumOnlyCard 
            title="プロフィール詳細は有料会員限定"
            description="女性の詳細なプロフィール、写真、情報を閲覧するには有料会員登録が必要です。"
            buttonText="有料会員になる"
            features={[
              "全ての写真を閲覧",
              "詳細なプロフィール情報",
              "いいね・メッセージ送信",
              "写メ日記の閲覧"
            ]}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-black">
        <p className="text-gray-900 dark:text-white">読み込み中...</p>
      </div>
    );
  }

  if (!girl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-black">
        <p className="text-gray-900 dark:text-white mb-4">プロフィールが見つかりません</p>
        <Button onClick={() => router.back()}>戻る</Button>
      </div>
    );
  }

  // Return content with or without premium access
  return (
    <>
      <div className="bg-white dark:bg-black" style={{ minHeight: '100vh' }}>
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">プロフィール</h1>
          </div>
            
          {/* 有料会員のみ表示 */}
          {isPremium ? (
          <div className="space-y-6">
              {/* Image Gallery */}
              <div className="aspect-[3/4] relative rounded-lg overflow-hidden">
                {girl.images.length > 0 ? (
                  <>
                    <Image
                      src={girl.images[currentImageIndex].image_url || girl.images[currentImageIndex].real_image_url || '/placeholder.jpg'}
                      alt={`${girl.name} - Photo ${currentImageIndex + 1}`}
                      fill
                      className="object-cover"
                      priority
                    />
                    
                    {/* Image Navigation */}
                    {girl.images.length > 1 && (
                      <>
                        {/* Previous Button */}
                        {currentImageIndex > 0 && (
                          <button
                            onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                        )}
                        
                        {/* Next Button */}
                        {currentImageIndex < Math.min(girl.images.length - 1, 4) && (
                          <button
                            onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>
                        )}
                        
                        {/* Image Indicators */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                          {girl.images.slice(0, 5).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentImageIndex
                                  ? 'bg-white'
                                  : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <p className="text-gray-500">No Photo</p>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {girl.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {girl.images.slice(0, 5).map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentImageIndex
                          ? 'border-primary ring-2 ring-primary ring-offset-2'
                          : 'border-transparent'
                      }`}
                    >
                      <Image
                        src={image.image_url || image.real_image_url || '/placeholder.jpg'}
                        alt={`${girl.name} - Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Profile Information Card */}
              <div className="rounded-lg border bg-card p-6 space-y-4">
                {/* Basic Info */}
                <div>
                  <h2 className="text-2xl font-bold mb-2">{girl.name}</h2>
                  {girl.age && <p className="text-lg text-gray-600 dark:text-gray-400">{girl.age}歳</p>}
                  {girl.location && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400 mt-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{girl.location}</span>
                      {distance !== null && (
                        <span className="ml-2 flex items-center">
                          <Navigation className="h-4 w-4 mr-1" />
                          {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Physical Info */}
                {(girl.height || girl.bust || girl.waist || girl.hip) && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">スタイル</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {girl.height && (
                        <div className="flex items-center">
                          <Ruler className="h-4 w-4 mr-2" />
                          <span>身長: {girl.height}cm</span>
                        </div>
                      )}
                      {girl.bust && (
                        <div>
                          <span>B: {girl.bust}{girl.cup && `(${girl.cup})`}</span>
                        </div>
                      )}
                      {girl.waist && (
                        <div>
                          <span>W: {girl.waist}</span>
                        </div>
                      )}
                      {girl.hip && (
                        <div>
                          <span>H: {girl.hip}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {girl.comment && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">コメント</h3>
                    <p className="whitespace-pre-wrap">{girl.comment}</p>
                  </div>
                )}

                {/* Photo Diaries */}
                {girl.photoDiaries && girl.photoDiaries.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-3">写メ日記</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {girl.photoDiaries.map((diary) => (
                        <div key={diary.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          {diary.title && (
                            <h4 className="font-semibold mb-2 text-pink-600">{diary.title}</h4>
                          )}
                          {diary.images && diary.images.length > 0 && (
                            <div className="flex justify-center mb-3">
                              <div className={`${diary.images.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-2 max-w-md'}`}>
                                {diary.images.map((imageUrl, index) => (
                                  <div key={index} className="relative w-40 h-40 rounded-lg overflow-hidden">
                                    <Image
                                      src={imageUrl}
                                      alt={`${diary.title || '写メ日記'} ${index + 1}`}
                                      fill
                                      className="object-cover hover:scale-105 transition-transform duration-300"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {diary.content && (
                            <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                              {diary.content}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {new Date(diary.created_at).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons - 2段レイアウト */}
              <div className="space-y-3">
                {/* 上段: いいね と メモ */}
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 h-14 text-base font-semibold bg-pink-500 hover:bg-pink-600 text-white" 
                    onClick={handleLike}
                    disabled={isProcessingLike}
                  >
                    <Heart className="h-5 w-5 mr-2" />
                    {isProcessingLike ? "送信中..." : "いいね"}
                  </Button>
                  {isPremium && !subscriptionLoading && (
                    <Button 
                      className="flex-1 h-14 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white border-0" 
                      onClick={() => router.push(`/messages/${girl.id}`)}
                    >
                      <StickyNote className="h-5 w-5 mr-2" />
                      メモ
                    </Button>
                  )}
                </div>
                
                {/* 下段: 君に決めた */}
                <Button 
                  className="w-full h-16 text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white flex items-center justify-center" 
                  onClick={handleReservation}
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  君に決めた
                </Button>
              </div>
            </div>
          ) : (
            <PremiumOnlyCard 
              title="プロフィール詳細は有料会員限定"
              description="女性の詳細なプロフィール、写真、情報を閲覧するには有料会員登録が必要です。"
              buttonText="有料会員になる"
              features={[
                "全ての写真を閲覧",
                "詳細なプロフィール情報",
                "いいね・メッセージ送信",
                "写メ日記の閲覧"
              ]}
            />
          )}
        </div>
      </div>
      
      {/* Reservation Confirmation Dialog */}
      <AlertDialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>外部サイトへ移動します</AlertDialogTitle>
            <AlertDialogDescription>
              この嬢と遊ぶには、外部の予約サイトに移動します。
              よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReservation}>
              予約ページへ進む
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}