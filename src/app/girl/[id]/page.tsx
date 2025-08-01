"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GirlWithDetails } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Calendar, Ruler, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import '@/styles/blur.css';

export default function GirlProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isPremium } = useSubscription();
  const [girl, setGirl] = useState<GirlWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchGirlDetails = async () => {
      try {
        const response = await fetch(`/api/girls/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setGirl(data);
        }
      } catch (error) {
        console.error('Error fetching girl details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchGirlDetails();
    }
  }, [params.id]);

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

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="ml-4 text-xl font-bold">{girl.name}</h1>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="aspect-[3/4] relative">
        {girl.images.length > 0 ? (
          <>
            <img
              src={girl.images[currentImageIndex].image_url || girl.images[currentImageIndex].real_image_url}
              alt={`${girl.name} - Photo ${currentImageIndex + 1}`}
              className={`w-full h-full object-cover ${!isPremium ? 'blur-image' : ''}`}
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
        <div className="px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {girl.images.slice(0, 5).map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentImageIndex
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-transparent'
                }`}
              >
                <img
                  src={image.image_url || image.real_image_url || ''}
                  alt={`${girl.name} - Thumbnail ${index + 1}`}
                  className={`w-full h-full object-cover ${!isPremium ? 'blur-image' : ''}`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Information */}
      <div className="p-4 space-y-4">
        {/* Basic Info */}
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold mb-2">{girl.name}</h2>
          {girl.age && <p className="text-lg text-gray-600">{girl.age}歳</p>}
          {girl.location && (
            <div className="flex items-center text-gray-600 mt-2">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{girl.location}</span>
            </div>
          )}
        </div>

        {/* Physical Info */}
        {(girl.height || girl.bust || girl.waist || girl.hip) && (
          <div className="border-b pb-4">
            <h3 className="font-bold mb-2">スタイル</h3>
            <div className={`grid grid-cols-2 gap-2 ${!isPremium ? 'blur-content' : ''}`}>
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
        <div className="border-b pb-4">
          <h3 className="font-bold mb-2">店舗情報</h3>
          <p className={`${!isPremium ? 'blur-content' : ''}`}>{girl.shop.name}</p>
          {girl.shop.tel && (
            <p className={`text-sm text-gray-600 ${!isPremium ? 'blur-content' : ''}`}>
              TEL: {girl.shop.tel}
            </p>
          )}
        </div>

        {/* Comments */}
        {girl.comment && (
          <div className="border-b pb-4">
            <h3 className="font-bold mb-2">コメント</h3>
            <p className={`whitespace-pre-wrap ${!isPremium ? 'blur-content' : ''}`}>{girl.comment}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button className="flex-1" variant="default">
            <Heart className="h-4 w-4 mr-2" />
            お気に入り
          </Button>
          <Button className="flex-1" variant="outline">
            予約する
          </Button>
        </div>
      </div>
    </div>
  );
}