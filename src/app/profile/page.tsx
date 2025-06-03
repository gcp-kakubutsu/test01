"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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


export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { profile, loading: profileLoading, error } = useUserProfile();
  const { stats, loading: statsLoading, error: statsError } = useUserStats();
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

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

  if (authLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  const age = profile.birthDate ? calculateAge(profile.birthDate) : null;
  const displayName = profile.username || 'ユーザー';
  const location = profile.location || '未設定';
  const occupation = profile.occupation || '未設定';
  const bio = profile.bio || 'まだ自己紹介がありません';
  const interests = profile.interests || [];
  const profilePhoto = profile.profilePhotoUrl || 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Profile Header */}
      <Card>
        <CardHeader className="relative pb-0">
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href="/profile/edit">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1" />
                編集
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={profilePhoto}
                  alt="Profile"
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              </div>
              <Link href="/profile/edit">
                <Button
                  size="sm"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0 bg-[#F0306A] hover:bg-[#E02860]"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {age && <span className="text-lg text-gray-600">{age}歳</span>}
                {profile.accountStatus === 'verified' && (
                  <Badge className="bg-blue-500">
                    <Shield className="h-3 w-3 mr-1" />
                    認証済み
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {occupation}
                </span>
              </div>
              
              {profile.gender && (
                <div className="mt-1">
                  <Badge variant="outline">
                    {profile.gender === 'male' ? '男性' : 
                     profile.gender === 'female' ? '女性' : 'その他'}
                  </Badge>
                </div>
              )}
            </div>
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
                  stats.likesReceived
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
                  stats.matchesCount
                )}
              </p>
              <p className="text-xs text-gray-600">マッチ</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <MessageCircle className="h-5 w-5 text-[#F0306A] mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {statsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : statsError ? (
                  '-'
                ) : (
                  stats.profileViews
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
          
          {/* Photos */}
          <div>
            <h3 className="font-semibold mb-2">写真</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <div className="relative w-full h-0 pb-[100%] overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
              {photos.length < 6 && (
                <Link href="/profile/edit" className="relative">
                  <div className="relative w-full h-0 pb-[100%] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Camera className="h-8 w-8 text-gray-400 mb-1" />
                      <p className="text-sm text-gray-500">写真を追加</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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