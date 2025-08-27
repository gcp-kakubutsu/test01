"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Settings, 
  CreditCard, 
  Shield, 
  Heart,
  MessageCircle,
  Users,
  Edit,
  Camera,
  ChevronRight,
  Star,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useUserProfile, useUserStats } from '@/lib/firebase/hooks';
import { calculateAge } from '@/lib/utils/date';
import { SubscriptionStatusSection } from '@/components/subscription/SubscriptionStatusSection';

export default function MyPage() {
  const { isAuthenticated, currentUser } = useAuth();
  const router = useRouter();
  const { profile, loading: profileLoading, error } = useUserProfile();
  const { stats, loading: statsLoading } = useUserStats();
  const [activeTab, setActiveTab] = useState('profile');
  
  // URLのハッシュからタブを設定
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'subscription') {
      setActiveTab('subscription');
    }
  }, []);
  
  // 認証チェック
  useEffect(() => {
    if (!isAuthenticated && !profileLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, profileLoading, router]);

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  const age = profile?.birthDate ? calculateAge(profile.birthDate) : null;
  const displayName = profile?.username || currentUser?.displayName || 'ユーザー';
  const location = profile?.location || '未設定';
  const occupation = profile?.occupation || '未設定';
  const bio = profile?.bio || 'まだ自己紹介がありません';
  const profilePhoto = profile?.profilePhotoUrl || 'https://placehold.co/400x400/FFB6C1/FFFFFF?text=No+Photo';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* ヘッダーセクション */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={profilePhoto}
                  alt="Profile"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <p className="text-gray-600">
                  {age && `${age}歳 • `}
                  {location}
                </p>
              </div>
            </div>
            <Link href="/profile/edit">
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-1" />
                編集
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* 統計情報 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <Heart className="h-6 w-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {statsLoading ? '-' : (stats?.likesReceived || 0)}
              </p>
              <p className="text-sm text-gray-600">いいね</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <Users className="h-6 w-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {statsLoading ? '-' : (stats?.matchesCount || 0)}
              </p>
              <p className="text-sm text-gray-600">マッチ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <MessageCircle className="h-6 w-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {statsLoading ? '-' : (stats?.requestsReceived || 0)}
              </p>
              <p className="text-sm text-gray-600">リクエスト</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブセクション */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="subscription">サブスクリプション</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          {/* プロフィール情報 */}
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">メールアドレス</p>
                  <p className="font-medium">{currentUser?.email || '未設定'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">職業</p>
                  <p className="font-medium">{occupation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">性別</p>
                  <p className="font-medium">
                    {profile?.gender === 'male' ? '男性' : 
                     profile?.gender === 'female' ? '女性' : '未設定'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">アカウント状態</p>
                  <div className="flex items-center gap-2">
                    {profile?.accountStatus === 'verified' ? (
                      <Badge className="bg-blue-500">
                        <Shield className="h-3 w-3 mr-1" />
                        認証済み
                      </Badge>
                    ) : (
                      <Badge variant="secondary">未認証</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-2">自己紹介</p>
                <p className="text-sm">{bio}</p>
              </div>
              
              <Link href="/profile">
                <Button className="w-full">
                  プロフィールを詳しく見る
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* フォトギャラリー */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>フォトギャラリー</CardTitle>
                <Link href="/profile/edit">
                  <Button variant="ghost" size="sm">
                    <Camera className="h-4 w-4 mr-1" />
                    写真を追加
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={profilePhoto}
                    alt="Photo 1"
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>
                {[2, 3, 4, 5, 6].map((i) => (
                  <Link 
                    key={i}
                    href="/profile/edit" 
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  >
                    <Camera className="h-8 w-8 text-gray-400" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="subscription" className="space-y-4">
          <SubscriptionStatusSection />
          
          {/* 支払い履歴 */}
          <Card>
            <CardHeader>
              <CardTitle>請求履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                過去の支払い履歴はこちらから確認できます。
              </p>
              <Button variant="outline" className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                請求履歴を見る
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          {/* アカウント設定 */}
          <Card>
            <CardHeader>
              <CardTitle>アカウント設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/settings">
                <Button variant="ghost" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  一般設定
                </Button>
              </Link>
              <Link href="/settings/privacy">
                <Button variant="ghost" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  プライバシー設定
                </Button>
              </Link>
              <Link href="/settings/notifications">
                <Button variant="ghost" className="w-full justify-start">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  通知設定
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 本人確認 */}
          {profile?.accountStatus !== 'verified' && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  本人確認
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  本人確認を完了すると、信頼性が向上しマッチ率がアップします。
                </p>
                <Link href="/verify">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600">
                    本人確認を開始
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* サポート */}
          <Card>
            <CardHeader>
              <CardTitle>サポート</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/help">
                <Button variant="ghost" className="w-full justify-start">
                  ヘルプセンター
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="ghost" className="w-full justify-start">
                  お問い合わせ
                </Button>
              </Link>
              <Link href="/terms">
                <Button variant="ghost" className="w-full justify-start">
                  利用規約
                </Button>
              </Link>
              <Link href="/privacy">
                <Button variant="ghost" className="w-full justify-start">
                  プライバシーポリシー
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* ログアウト */}
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={() => {
              // ログアウト処理
              router.push('/logout');
            }}
          >
            ログアウト
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}