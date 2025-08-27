"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, Search, Loader2, ChevronLeft, UserCheck, UserPlus, Trash2 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumOnlyCard from '@/components/PremiumOnlyCard';

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  imageUrl: string;
  isJoined?: boolean;
  members?: string[];
  createdAt?: any;
  createdBy?: string;
}

export default function CommunityListPage() {
  const { isAuthenticated, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Check if current user is admin
  const isAdmin = currentUser?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(currentUser.email);

  // 認証チェック
  useEffect(() => {
    if (!subscriptionLoading && !isAuthenticated && !currentUser) {
      router.push('/login');
    }
  }, [isAuthenticated, currentUser, router, subscriptionLoading]);

  // Fetch communities
  useEffect(() => {
    if (subscriptionLoading) return;
    
    if (!currentUser || (!isPremium && !subscriptionLoading)) {
      setLoadingCommunities(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const fetchCommunities = async () => {
      try {
        setLoadingCommunities(true);
        
        if (!db) {
          setTimeout(() => {
            if (isMounted) fetchCommunities();
          }, 500);
          return;
        }
        
        const communitiesRef = collection(db, 'communities');
        const communitiesQuery = query(communitiesRef, orderBy('memberCount', 'desc'));
        
        unsubscribe = onSnapshot(communitiesQuery, 
          (snapshot) => {
            if (!isMounted || !currentUser) return;
            
            const communitiesData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                isJoined: data.members?.includes(currentUser.uid) || false
              } as Community;
            });
            
            setCommunities(communitiesData);
            
            // Extract unique categories
            const uniqueCategories = Array.from(new Set(
              communitiesData.map(c => c.category).filter(Boolean)
            ));
            setCategories(uniqueCategories);
            
            setLoadingCommunities(false);
          },
          (error) => {
            if (!isMounted) return;
            console.error('Error fetching communities:', error);
            setLoadingCommunities(false);
          }
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Error setting up communities listener:', error);
        setLoadingCommunities(false);
      }
    };

    fetchCommunities();
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.uid, isPremium, subscriptionLoading]);

  const handleJoinCommunity = async (communityId: string, isJoined: boolean) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      const community = communities.find(c => c.id === communityId);
      if (!community) return;
      
      const communityRef = doc(db, 'communities', communityId);
      const members = community.members || [];
      
      if (isJoined) {
        // 退会
        await updateDoc(communityRef, {
          members: members.filter(uid => uid !== currentUser.uid),
          memberCount: increment(-1)
        });
        
        toast({
          title: "退会しました",
          description: `${community.name}から退会しました。`,
        });
      } else {
        // 参加
        await updateDoc(communityRef, {
          members: [...members, currentUser.uid],
          memberCount: increment(1)
        });
        
        toast({
          title: "参加しました",
          description: `${community.name}に参加しました。`,
        });
      }
    } catch (error: any) {
      console.error('Error updating community membership:', error);
      toast({
        title: "エラー",
        description: "コミュニティの参加状態の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteCommunity = async (communityId: string) => {
    const community = communities.find(c => c.id === communityId);
    if (!community) return;
    
    const confirmMessage = isAdmin && community.createdBy !== currentUser?.uid
      ? `管理者として「${community.name}」を削除しますか？`
      : `「${community.name}」を削除しますか？この操作は元に戻せません。`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      // コミュニティの投稿を削除
      const postsQuery = query(
        collection(db, 'posts'),
        where('communityId', '==', communityId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      
      for (const postDoc of postsSnapshot.docs) {
        await deleteDoc(doc(db, 'posts', postDoc.id));
      }
      
      // コミュニティを削除
      await deleteDoc(doc(db, 'communities', communityId));
      
      toast({
        title: "削除完了",
        description: `「${community.name}」を削除しました。`,
      });
    } catch (error: any) {
      console.error('Error deleting community:', error);
      toast({
        title: "エラー",
        description: "コミュニティの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  // Filter communities
  const filteredCommunities = communities.filter(community => {
    const matchesSearch = !searchQuery || 
      community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategories.length === 0 || 
      selectedCategories.includes(community.category);
    
    return matchesSearch && matchesCategory;
  });

  // Check premium status
  if (!subscriptionLoading && !isPremium) {
    return <PremiumOnlyCard />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 pb-4 mb-6">
          {/* Mobile/Tablet Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="p-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold">コミュニティ一覧</h1>
                  <Badge variant="outline" className="text-xs">
                    {communities.length} コミュニティ
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => router.push('/community')}
                size="sm"
                className="bg-[#F0306A] hover:bg-[#E02860] text-sm"
              >
                コミュニティへ戻る
              </Button>
            </div>
          </div>
          
          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">コミュニティ一覧</h1>
              <Badge variant="outline">{communities.length} コミュニティ</Badge>
            </div>
            <Button 
              onClick={() => router.push('/community')}
              className="bg-[#F0306A] hover:bg-[#E02860]"
            >
              コミュニティへ戻る
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="コミュニティを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {categories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategories.length === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategories([])}
                  className={selectedCategories.length === 0 ? "bg-[#F0306A] hover:bg-[#E02860]" : ""}
                >
                  すべて
                </Button>
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategories.includes(category) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (selectedCategories.includes(category)) {
                        setSelectedCategories(selectedCategories.filter(c => c !== category));
                      } else {
                        setSelectedCategories([...selectedCategories, category]);
                      }
                    }}
                    className={selectedCategories.includes(category) ? "bg-[#F0306A] hover:bg-[#E02860]" : ""}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Communities Grid */}
        {loadingCommunities ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">読み込み中...</p>
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || selectedCategories.length > 0 
                ? "条件に一致するコミュニティが見つかりません" 
                : "コミュニティがありません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCommunities.map((community) => (
              <Card key={community.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
                <div className="h-32 relative flex-shrink-0">
                  <Image
                    src={community.imageUrl || 'https://placehold.co/400x200/FFB6C1/FFFFFF?text=' + encodeURIComponent(community.name)}
                    alt={community.name}
                    fill
                    className="object-cover"
                  />
                  {community.category && (
                    <Badge className="absolute top-2 left-2 bg-black/50 text-white">
                      {community.category}
                    </Badge>
                  )}
                  {(community.createdBy === currentUser?.uid || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCommunity(community.id);
                      }}
                      className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-white text-red-500 hover:text-red-600"
                      title={isAdmin && community.createdBy !== currentUser?.uid ? "管理者として削除" : "削除"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="p-4 flex flex-col h-full">
                  {/* コミュニティ名 - 1行目 */}
                  <div className="mb-2">
                    <h3 className="font-bold text-lg truncate">{community.name}</h3>
                  </div>
                  
                  {/* 説明 - 2-3行目 */}
                  <div className="mb-3 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {community.description}
                    </p>
                  </div>
                  
                  {/* メンバー数 - 4行目 */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 flex-shrink-0 text-gray-500" />
                      <span className="text-sm text-gray-500">{community.memberCount}人のメンバー</span>
                    </div>
                  </div>
                  
                  {/* ボタン - 5行目 */}
                  <div>
                    <Button
                      size="sm"
                      variant={community.isJoined ? "outline" : "default"}
                      onClick={() => handleJoinCommunity(community.id, community.isJoined || false)}
                      className={`w-full ${!community.isJoined ? "bg-[#F0306A] hover:bg-[#E02860]" : ""}`}
                    >
                      {community.isJoined ? (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          <span>参加中</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          <span>参加する</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}