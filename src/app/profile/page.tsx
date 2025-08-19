"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Edit, 
  MapPin, 
  Briefcase, 
  Heart, 
  Users, 
  MessageCircle,
  Star,
  Shield,
  Camera,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useUserProfile, useUserStats } from '@/lib/firebase/hooks';
import { calculateAge } from '@/lib/utils/date';
import { getMalePreferences, type MalePreferences } from '@/lib/firebase/malePreferences';


export default function ProfilePage() {
  const { isAuthenticated, currentUser } = useAuth(); // search/advancedと同じく、isLoadingやhasInitializedを使わない
  const router = useRouter();
  const { profile, loading: profileLoading, error } = useUserProfile();
  const { stats, loading: statsLoading, error: statsError } = useUserStats();
  
  // Refresh stats when profile data changes to ensure accurate counts
  useEffect(() => {
    // Stats will automatically refresh when currentUser changes
  }, [profile]);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [malePreferences, setMalePreferences] = useState<MalePreferences | null>(null);

  useEffect(() => {
    if (profile) {
      // Calculate profile completion
      let completion = 0;
      if (profile.username) completion += 20;
      if (profile.birthDate) completion += 20;
      if (profile.bio) completion += 20;
      if (profile.profilePhotoUrl) completion += 20;
      if (profile.interests && profile.interests.length > 0) completion += 20;
      setProfileCompletion(completion);
      
      // Set photos array (profile photo + additional photos)
      const allPhotos = [];
      if (profile.profilePhotoUrl) allPhotos.push(profile.profilePhotoUrl);
      if (profile.additionalPhotos && Array.isArray(profile.additionalPhotos)) {
        allPhotos.push(...profile.additionalPhotos);
      }
      setPhotos(allPhotos);
    }
  }, [profile]);

  // Load male preferences for male users
  useEffect(() => {
    const loadMalePreferences = async () => {
      if (currentUser && profile?.gender === 'male') {
        try {
          const preferences = await getMalePreferences(currentUser.uid);
          setMalePreferences(preferences);
        } catch (error) {
          console.error('Error loading male preferences:', error);
        }
      }
    };

    if (currentUser && profile) {
      loadMalePreferences();
    }
  }, [currentUser, profile]);

  // search/advancedと同じく、何も待たずに即座にページを表示
  // ローディング表示を完全に削除

  const age = profile?.birthDate ? calculateAge(profile.birthDate) : null;
  const displayName = profile?.username || currentUser?.displayName || 'ユーザー';
  const location = profile?.location || '未設定';
  const occupation = profile?.occupation || '未設定';
  const bio = profile?.bio || 'まだ自己紹介がありません';
  const interests = profile?.interests || [];
  const profilePhoto = profile?.profilePhotoUrl || 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Profile Header */}
      <Card>
        <CardHeader className="pb-0">
          {/* Action Buttons - Above the image */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">マイプロフィール</h2>
            <div className="flex gap-2">
              <Link href="/profile/edit">
                <Button variant="outline" size="sm" className="bg-white/90 backdrop-blur-sm">
                  <Edit className="h-4 w-4 mr-1" />
                  編集
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="bg-white/90 backdrop-blur-sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Large Profile Image */}
          <div className="relative h-[400px] sm:h-[450px] md:h-[500px] rounded-lg overflow-hidden mb-6">
            <Image
              src={profilePhoto}
              alt="Profile"
              fill
              className="object-cover w-full h-full"
              style={{
                imageRendering: 'crisp-edges',
                filter: 'contrast(1.05) saturate(1.1) sharpen(1)',
              }}
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={100}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            
            {/* User Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{displayName}</h1>
                {age && <span className="text-xl sm:text-2xl">{age}歳</span>}
                {profile?.accountStatus === 'verified' && (
                  <Badge className="bg-blue-500/80 backdrop-blur-sm">
                    <Shield className="h-3 w-3 mr-1" />
                    認証済み
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm mb-2">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {occupation}
                </span>
              </div>
              
              {profile?.gender && (
                <div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {profile?.gender === 'male' ? '男性' : 
                     profile?.gender === 'female' ? '女性' : 'その他'}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Quick Edit Camera Button */}
            <Link href="/profile/edit">
              <Button
                size="sm"
                className="absolute top-4 right-4 rounded-full h-10 w-10 p-0 bg-[#F0306A]/90 hover:bg-[#E02860] backdrop-blur-sm shadow-lg"
              >
                <Camera className="h-4 w-4 text-white" />
              </Button>
            </Link>
          </div>
          
          {/* Profile Completion */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>プロフィール完成度</span>
              <span className="font-semibold">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
            {profileCompletion < 100 && (
              <p className="text-xs text-gray-500 mt-1">
                プロフィールを100%にすると、マッチ率が3倍になります！
              </p>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Stats - Real data from Firebase */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Heart className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {statsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : statsError ? (
                  '-'
                ) : (
                  stats?.likesReceived || 0
                )}
              </p>
              <p className="text-xs text-gray-600">いいね</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Users className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {statsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : statsError ? (
                  '-'
                ) : (
                  stats?.matchesCount || 0
                )}
              </p>
              <p className="text-xs text-gray-600">プレイ数</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <MessageCircle className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {statsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : statsError ? (
                  '-'
                ) : (
                  stats?.profileViews || 0
                )}
              </p>
              <p className="text-xs text-gray-600">閲覧数</p>
            </div>
          </div>
          
          {/* Bio */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">自己紹介</h3>
            <p className="text-gray-700">{bio}</p>
          </div>
          
          {/* Interests */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">興味・趣味</h3>
            <div className="flex flex-wrap gap-2">
              {interests.length > 0 ? (
                interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-gray-500">まだ設定されていません</p>
              )}
            </div>
          </div>
          
          {/* Additional Photos Gallery */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">フォトギャラリー</h3>
              {photos.length > 1 && (
                <Badge variant="secondary" className="bg-[#F0306A]/10 text-[#F0306A]">
                  {photos.length - 1}枚の写真
                </Badge>
              )}
            </div>
            
            {photos.length > 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {photos.slice(1).map((photo, index) => (
                  <div key={index + 1} className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="relative w-full aspect-square">
                      <Image
                        src={photo}
                        alt={`Photo ${index + 2}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover w-full h-full"
                        style={{
                          imageRendering: 'crisp-edges',
                          filter: 'contrast(1.05) saturate(1.1) sharpen(1)',
                        }}
                        quality={100}
                        priority={index === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Photo Index Badge */}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {index + 2}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add Photo Button */}
                {photos.length < 6 && (
                  <Link href="/profile/edit" className="relative group">
                    <div className="relative w-full h-0 pb-[120%] sm:pb-[100%] lg:pb-[80%] border-2 border-dashed border-[#F0306A]/30 rounded-xl flex items-center justify-center hover:border-[#F0306A]/60 hover:bg-[#F0306A]/5 transition-all duration-300 bg-gradient-to-br from-[#F0306A]/5 to-[#F0306A]/10">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                        <div className="w-16 h-16 rounded-full bg-[#F0306A]/10 flex items-center justify-center mb-3 group-hover:bg-[#F0306A]/20 transition-colors duration-300">
                          <Camera className="h-8 w-8 text-[#F0306A]" />
                        </div>
                        <p className="text-sm font-medium text-[#F0306A] text-center">写真を追加</p>
                        <p className="text-xs text-gray-500 text-center mt-1">最大6枚まで</p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Link href="/profile/edit" className="relative group">
                  <div className="relative w-full h-0 pb-[120%] sm:pb-[100%] lg:pb-[80%] border-2 border-dashed border-[#F0306A]/30 rounded-xl flex items-center justify-center hover:border-[#F0306A]/60 hover:bg-[#F0306A]/5 transition-all duration-300 bg-gradient-to-br from-[#F0306A]/5 to-[#F0306A]/10">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                      <div className="w-20 h-20 rounded-full bg-[#F0306A]/10 flex items-center justify-center mb-4 group-hover:bg-[#F0306A]/20 transition-colors duration-300">
                        <Camera className="h-10 w-10 text-[#F0306A]" />
                      </div>
                      <p className="text-base font-semibold text-[#F0306A] text-center mb-2">追加の写真をアップロード</p>
                      <p className="text-sm text-gray-500 text-center">あなたの魅力をもっと伝えましょう</p>
                      <p className="text-xs text-gray-400 text-center mt-1">最大6枚まで追加可能</p>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Male User Preferences Section */}
      {profile?.gender === 'male' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900">詳細設定</CardTitle>
              <Badge variant={malePreferences?.isComplete ? "default" : "secondary"} className={malePreferences?.isComplete ? "bg-green-500" : "bg-yellow-500"}>
                {malePreferences?.isComplete ? "設定完了" : "設定未完了"}
              </Badge>
            </div>
            <p className="text-gray-600">相手探しの条件や嗜好の設定</p>
          </CardHeader>
          <CardContent>
            {malePreferences?.isComplete ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">年齢範囲</p>
                    <p className="font-medium">{malePreferences.partnerAgeMin}-{malePreferences.partnerAgeMax}歳</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">体型</p>
                    <p className="font-medium">{malePreferences.partnerBodyType || '未設定'}</p>
                  </div>
                </div>
                
                {malePreferences.partnerBodyTypes && malePreferences.partnerBodyTypes.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">希望する相手の体型</p>
                    <div className="flex flex-wrap gap-2">
                      {malePreferences.partnerBodyTypes.map((bodyType) => (
                        <Badge key={bodyType} variant="outline" className="text-xs">
                          {bodyType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button variant="outline" className="w-full" onClick={() => router.push('/profile/preferences')}>
                  <Settings className="h-4 w-4 mr-2" />
                  詳細設定を編集
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 mb-4">マッチングを開始するには詳細設定の完了が必要です</p>
                <Button className="bg-[#F0306A] hover:bg-[#E02860]" onClick={() => router.push('/profile/preferences')}>
                  詳細設定を開始
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Premium Upsell */}
      <Card className="bg-gradient-to-r from-[#F0306A] to-[#FF7F50] text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 fill-white" />
                <h3 className="text-lg font-bold">プレミアムメンバー</h3>
              </div>
              <p className="text-sm opacity-90">
                無制限のいいね、メッセージの既読確認など
              </p>
            </div>
            <Button variant="secondary" className="bg-white text-[#F0306A] hover:bg-gray-100">
              詳細を見る
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/verify">
          <Button variant="outline" className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            本人確認
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="outline" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            設定
          </Button>
        </Link>
      </div>
    </div>
  );
}