"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Heart, Search, MapPin, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';

interface LikedGirl {
  id: string;
  likeId: string;
  girlId: string;
  girlName: string;
  girlImage?: string;
  girlLocation?: string;
  shopName?: string;
  shopId?: string;
  createdAt: Date;
}

export default function LikesPage() {
  const { currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [likes, setLikes] = useState<LikedGirl[]>([]);
  const [filteredLikes, setFilteredLikes] = useState<LikedGirl[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [girlsData, setGirlsData] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchLikes();
  }, [isAuthenticated, currentUser]);

  const fetchLikes = async () => {
    if (!currentUser || !db) return;

    setLoading(true);
    try {
      // Firestoreからいいねを取得（indexエラーを避けるためorderByを削除）
      const likesRef = collection(db, 'likes');
      const q = query(
        likesRef,
        where('from', '==', currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      const likesData: LikedGirl[] = [];
      const girlIds: string[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // mysql_girl_で始まるIDから実際のIDを抽出
        if (data.to && data.to.startsWith('mysql_girl_')) {
          const girlId = data.to.replace('mysql_girl_', '');
          girlIds.push(girlId);
          
          likesData.push({
            id: doc.id,
            likeId: doc.id,
            girlId: girlId,
            girlName: data.toGirlName || '名前不明',
            createdAt: data.createdAt?.toDate() || new Date(),
            girlImage: undefined,
            girlLocation: undefined,
            shopName: undefined,
            shopId: undefined,
          });
        }
      });
      
      // クライアント側で日付順にソート
      likesData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // MySQLから女の子の詳細情報を取得（バッチAPIで高速化）
      if (girlIds.length > 0) {
        const girlsMap = new Map<string, any>();
        
        // バッチAPIで一括取得（高速化）
        try {
          const response = await fetch('/api/girls/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: girlIds })
          });
          
          if (response.ok) {
            const girlsData = await response.json();
            Object.entries(girlsData).forEach(([id, data]) => {
              girlsMap.set(id, data);
            });
          }
        } catch (error) {
          console.error('Failed to fetch girls batch:', error);
        }

        // いいねデータに女の子情報をマージ
        likesData.forEach((like) => {
          const girlData = girlsMap.get(like.girlId);
          if (girlData) {
            like.girlImage = girlData.images?.[0]?.image_url || girlData.images?.[0]?.real_image_url;
            like.girlLocation = girlData.location || girlData.shop?.area_name;
            like.shopName = girlData.shop?.name;
            like.shopId = girlData.shop_profile_id;
          }
        });

        setGirlsData(girlsMap);
      }

      setLikes(likesData);
      setFilteredLikes(likesData);
    } catch (error) {
      console.error('Error fetching likes:', error);
      toast({
        title: 'エラー',
        description: 'いいねの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 検索処理
  useEffect(() => {
    let filtered = [...likes];

    // 都道府県で検索
    if (searchQuery) {
      filtered = filtered.filter((like) =>
        like.girlLocation?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLikes(filtered);
  }, [searchQuery, likes]);

  const handleDeleteLike = async (likeId: string) => {
    if (!db) return;

    try {
      await deleteDoc(doc(db, 'likes', likeId));
      setLikes(likes.filter(like => like.likeId !== likeId));
      toast({
        title: '削除しました',
        description: 'いいねを削除しました',
      });
    } catch (error) {
      console.error('Error deleting like:', error);
      toast({
        title: 'エラー',
        description: 'いいねの削除に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const navigateToGirlProfile = (girlId: string) => {
    router.push(`/girl/${girlId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/home">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                いいね管理
              </CardTitle>
            </div>
            <div className="text-sm text-gray-600">
              {filteredLikes.length} / {likes.length} 件
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 検索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="都道府県で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* いいねリスト */}
      {filteredLikes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchQuery 
                ? '該当するいいねが見つかりません' 
                : 'まだいいねがありません'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLikes.map((like) => (
            <Card key={like.likeId} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* 画像 */}
                  <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {like.girlImage ? (
                      <Image
                        src={like.girlImage}
                        alt={like.girlName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Heart className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg mb-1">{like.girlName}</h3>
                    
                    {like.girlLocation && (
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {like.girlLocation}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      {like.createdAt.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigateToGirlProfile(like.girlId)}
                      className="bg-pink-500 hover:bg-pink-600"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      詳細
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteLike(like.likeId)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      削除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}