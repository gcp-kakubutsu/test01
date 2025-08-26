"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GirlWithDetails } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Ruler, Heart, ChevronLeft, ChevronRight, Navigation, StickyNote, ExternalLink } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
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
  Timestamp 
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
  const { isPremium, loading: subscriptionLoading } = useSubscription();
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
  
  // Get user location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const locationInfo = await getCurrentLocation();
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

  // Generate reservation URL with proper parameters
  const generateReservationUrl = () => {
    if (!girl) return '';
    
    const baseUrl = process.env.NEXT_PUBLIC_RESERVATION_SITE_URL || 'https://stg.nukipedia.jp';
    
    // Get region and prefecture from location or shop data
    let fromRegion = '関東';
    let fromRegionId = '3';
    let fromPrefecture = '東京';
    let fromPrefectureId = '13';
    
    // Try to determine location from girl's location string
    if (girl.location) {
      if (girl.location.includes('東京')) {
        fromPrefecture = '東京';
        fromPrefectureId = '13';
      } else if (girl.location.includes('神奈川')) {
        fromPrefecture = '神奈川';
        fromPrefectureId = '14';
      } else if (girl.location.includes('千葉')) {
        fromPrefecture = '千葉';
        fromPrefectureId = '12';
      } else if (girl.location.includes('埼玉')) {
        fromPrefecture = '埼玉';
        fromPrefectureId = '11';
      }
      // Add more prefecture mappings as needed
    }
    
    // Use area_prefecture_id if available
    if (girl.shop?.area_prefecture_id) {
      fromPrefectureId = girl.shop.area_prefecture_id.toString();
    }
    
    const params = new URLSearchParams({
      shopId: girl.shop_profile_id.toString(),
      girlId: girl.id.toString(),
      fromRegion: fromRegion,
      fromRegionId: fromRegionId,
      fromPrefecture: fromPrefecture,
      fromPrefectureId: fromPrefectureId,
      fromGenre: 'デリヘル,ホテヘル,ヘルス,ソープ,風俗エステ,その他',
      fromSearchType: 'search'
    });
    
    return `${baseUrl}/reservation/course?${params.toString()}`;
  };

  const handleReservation = () => {
    setShowReservationDialog(true);
  };

  const confirmReservation = () => {
    const reservationUrl = generateReservationUrl();
    window.open(reservationUrl, '_blank');
    setShowReservationDialog(false);
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
                
                {/* 下段: この嬢に決めた */}
                <Button 
                  className="w-full h-16 text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white flex items-center justify-center" 
                  onClick={handleReservation}
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  この嬢に決めた
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