"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GirlWithDetails } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Ruler, Heart, ChevronLeft, ChevronRight, Navigation, StickyNote } from 'lucide-react';
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

export default function GirlProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [girl, setGirl] = useState<GirlWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessingLike, setIsProcessingLike] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    const fetchGirlDetails = async () => {
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

    if (params.id) {
      fetchGirlDetails();
    }
  }, [params.id, userLocation]);
  
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

    // Check if db is initialized
    if (!db) {
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
      const likesRef = collection(db, 'likes');
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
  }, [currentUser, girl, isProcessingLike, isAuthenticated, router]);

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
          
          {!isPremium && !subscriptionLoading ? (
            <PremiumOnlyCard 
              title={getPremiumMessage('profile').title}
              description={getPremiumMessage('profile').description}
              buttonText={getPremiumMessage('profile').buttonText}
              features={getPremiumMessage('profile').features}
            />
          ) : (
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

                {/* Shop Information */}
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-2">店舗情報</h3>
                  <p>{girl.shop.name}</p>
                  {distance !== null && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <Navigation className="h-4 w-4 mr-1" />
                      <span>
                        現在地から約{distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                      </span>
                    </div>
                  )}
                  {girl.shop.tel && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      TEL: {girl.shop.tel}
                    </p>
                  )}
                </div>

                {/* Comments */}
                {girl.comment && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">コメント</h3>
                    <p className="whitespace-pre-wrap">{girl.comment}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  variant="default"
                  onClick={handleLike}
                  disabled={isProcessingLike}
                >
                  <Heart className="h-4 w-4 mr-2" />
                  {isProcessingLike ? "送信中..." : "いいね"}
                </Button>
                {isPremium && (
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => router.push(`/messages/${girl.id}`)}
                  >
                    <StickyNote className="h-4 w-4 mr-2" />
                    メモ
                  </Button>
                )}
                <Button className="flex-1" variant="outline">
                  予約する
                </Button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}