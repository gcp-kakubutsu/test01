"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, MessageCircle, Clock, Sparkles, Loader2, User, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMatches, fetchUserProfiles } from '@/lib/firebase/hooks';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { sendLike } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';

interface Match {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  matchedAt: Date;
  lastMessage?: string;
  isNew?: boolean;
}

interface Like {
  id: string;
  userId: string;
  name: string;
  age: number;
  imageUrl: string;
  bio?: string;
  location?: string;
  createdAt: Date;
  type: 'sent' | 'received';
  isGirlProfile?: boolean; // Flag for MySQL girl profiles
  girlId?: string; // MySQL girl ID
}

export default function MatchesPage() {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { matches, loading: matchesLoading } = useMatches();
  const [activeTab, setActiveTab] = useState('matches');
  const [displayMatches, setDisplayMatches] = useState<Match[]>([]);
  const [sentLikes, setSentLikes] = useState<Like[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<Like[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessingLike, setIsProcessingLike] = useState(false);
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [likedBackUsers, setLikedBackUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load matches and likes
  useEffect(() => {
    const loadMatchesAndLikes = async () => {
      if (!currentUser || !db) return;
      
      setIsLoadingData(true);
      
      try {
        // Load matches
        if (!matchesLoading && matches.length > 0) {
          const otherUserIds = matches.map(match => 
            match.users.find(uid => uid !== currentUser.uid)
          ).filter(Boolean) as string[];
          
          const userProfiles = await fetchUserProfiles(otherUserIds);
          
          const matchList: Match[] = matches.map(match => {
            const otherUserId = match.users.find(uid => uid !== currentUser.uid);
            const otherUser = otherUserId ? userProfiles.get(otherUserId) : null;
            
            return {
              id: match.id,
              name: otherUser?.username || 'ユーザー',
              age: otherUser?.age || 20,
              imageUrl: otherUser?.profilePhotoUrl || 'https://placehold.co/200x200/F0306A/FFF.png?text=U',
              matchedAt: match.matchedAt?.toDate() || new Date(),
              lastMessage: match.lastMessage,
              isNew: false
            };
          });
          
          setDisplayMatches(matchList);
        }
        
        // Load sent likes (without orderBy to avoid index requirement initially)
        const sentLikesQuery = query(
          collection(db, 'likes'),
          where('from', '==', currentUser.uid)
        );
        const sentLikesSnapshot = await getDocs(sentLikesQuery);
        const sentLikeUserIds = sentLikesSnapshot.docs.map(doc => doc.data().to);
        
        // Load received likes (without orderBy to avoid index requirement initially)
        const receivedLikesQuery = query(
          collection(db, 'likes'),
          where('to', '==', currentUser.uid)
        );
        const receivedLikesSnapshot = await getDocs(receivedLikesQuery);
        const receivedLikeUserIds = receivedLikesSnapshot.docs.map(doc => doc.data().from);
        
        // Fetch all user profiles
        const allUserIds = [...new Set([...sentLikeUserIds, ...receivedLikeUserIds])];
        const allUserProfiles = await fetchUserProfiles(allUserIds);
        
        // Collect MySQL girl IDs from sent likes
        const mysqlGirlIds: string[] = [];
        const sentLikesData: Array<{ doc: any, data: any }> = [];
        
        sentLikesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          sentLikesData.push({ doc, data });
          if (data.isGirlProfile && data.toGirlId) {
            mysqlGirlIds.push(data.toGirlId);
          }
        });
        
        // Batch fetch MySQL girl data if needed
        let mysqlGirlsData: Record<string, any> = {};
        if (mysqlGirlIds.length > 0) {
          try {
            const response = await fetch('/api/girls/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: mysqlGirlIds })
            });
            if (response.ok) {
              mysqlGirlsData = await response.json();
            }
          } catch (error) {
            console.error('Error fetching girls batch:', error);
          }
        }
        
        // Process sent likes with fetched data
        const sentLikesList: Like[] = sentLikesData.map(({ doc, data }) => {
          const targetUserId = data.to;
          
          // Check if this is a MySQL girl like
          if (data.isGirlProfile && data.toGirlId) {
            const girlData = mysqlGirlsData[data.toGirlId];
            if (girlData) {
              return {
                id: doc.id,
                userId: targetUserId,
                name: data.toGirlName || girlData.name || 'ユーザー',
                age: girlData.age || 20,
                imageUrl: girlData.images?.[0]?.image_url || girlData.images?.[0]?.real_image_url || 'https://placehold.co/200x200/F0306A/FFF.png?text=G',
                bio: girlData.comment,
                location: girlData.location,
                createdAt: data.createdAt?.toDate() || new Date(),
                type: 'sent' as const,
                isGirlProfile: true,
                girlId: data.toGirlId
              };
            }
          }
          
          // Regular Firebase user
          const userProfile = allUserProfiles.get(targetUserId);
          return {
            id: doc.id,
            userId: targetUserId,
            name: userProfile?.username || 'ユーザー',
            age: userProfile?.age || 20,
            imageUrl: userProfile?.profilePhotoUrl || 'https://placehold.co/200x200/F0306A/FFF.png?text=U',
            bio: userProfile?.bio,
            location: userProfile?.location,
            createdAt: data.createdAt?.toDate() || new Date(),
            type: 'sent' as const
          };
        });
        
        // Sort by date desc
        sentLikesList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        // Process received likes
        const receivedLikesList: Like[] = receivedLikesSnapshot.docs.map(doc => {
          const data = doc.data();
          const senderUserId = data.from; // The user who sent the like to us
          const userProfile = allUserProfiles.get(senderUserId);
          
          return {
            id: doc.id,
            userId: senderUserId, // This should be the sender's ID
            name: userProfile?.username || 'ユーザー',
            age: userProfile?.age || 20,
            imageUrl: userProfile?.profilePhotoUrl || 'https://placehold.co/200x200/F0306A/FFF.png?text=U',
            bio: userProfile?.bio,
            location: userProfile?.location,
            createdAt: data.createdAt?.toDate() || new Date(),
            type: 'received' as const
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by date desc
        
        // Check which received likes have been liked back (exist in sent likes)
        const alreadyLikedBackUserIds = new Set(
          receivedLikesList.filter(receivedLike => 
            sentLikeUserIds.includes(receivedLike.userId)
          ).map(like => like.userId)
        );
        
        setSentLikes(sentLikesList);
        setReceivedLikes(receivedLikesList);
        setLikedBackUsers(alreadyLikedBackUserIds);
        
      } catch (error) {
        console.error('Error loading likes:', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    
    loadMatchesAndLikes();
  }, [matches, matchesLoading, currentUser]);

  if (authLoading || isLoadingData) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }
  
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ja });
  };

  const MatchCard = ({ match, showMessage = true }: { match: Match; showMessage?: boolean }) => (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => showMessage && router.push(`/messages/${match.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Image
              src={match.imageUrl}
              alt={match.name}
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
            {match.isNew && (
              <div className="absolute -top-1 -right-1 bg-[#F0306A] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                <Sparkles className="h-3 w-3" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{match.name}</h3>
              <span className="text-sm text-gray-500">{match.age}歳</span>
            </div>
            
            {match.lastMessage ? (
              <p className="text-sm text-gray-600 line-clamp-2">{match.lastMessage}</p>
            ) : (
              <p className="text-sm text-gray-400">メッセージを送ってみましょう</p>
            )}
            
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatDate(match.matchedAt)}</span>
            </div>
          </div>
          
          {showMessage && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#F0306A]"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/messages/${match.id}`);
              }}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const handleLikeBack = async (like: Like) => {
    if (processingLikes.has(like.userId) || likedBackUsers.has(like.userId) || !currentUser) return;
    
    console.log('Sending like back to:', like.userId);
    
    // Add to processing set
    setProcessingLikes(prev => new Set(prev).add(like.userId));
    
    try {
      const result = await sendLike(currentUser.uid, like.userId);
      console.log('Like back result:', result);
      
      if (result.alreadyLiked) {
        toast({
          title: "既にいいねを送っています",
          description: `${like.name}さんには既にいいねを送信済みです。`,
        });
      } else if (result.isMatch) {
        toast({
          title: "マッチしました！🎉",
          description: `${like.name}さんとマッチしました！メッセージを送ってみましょう。`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/messages/${result.matchId}`)}
            >
              メッセージを送る
            </Button>
          ),
        });
        
        // Reload to update matches list after a delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast({
          title: "いいねを返しました！",
          description: `${like.name}さんにいいねを返しました。`,
        });
        
        // Add to sent likes list
        const newSentLike: Like = {
          ...like,
          type: 'sent' as const,
          createdAt: new Date()
        };
        setSentLikes(prev => [newSentLike, ...prev]);
      }
      
      // Mark user as liked back (for all cases)
      setLikedBackUsers(prev => new Set(prev).add(like.userId));
      
    } catch (error) {
      console.error('Error sending like back:', error);
      toast({
        title: "エラー",
        description: "いいねの送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      // Remove from processing set
      setProcessingLikes(prev => {
        const newSet = new Set(prev);
        newSet.delete(like.userId);
        return newSet;
      });
    }
  };

  const LikeCard = ({ like, showLikeButton = false, clickable = false }: { like: Like; showLikeButton?: boolean; clickable?: boolean }) => {
    const handleCardClick = () => {
      if (clickable) {
        if (like.isGirlProfile && like.girlId) {
          // Navigate to MySQL girl profile
          router.push(`/girl/${like.girlId}`);
        } else if (like.userId && like.userId !== currentUser?.uid) {
          // Navigate to Firebase user profile
          router.push(`/user/${like.userId}`);
        }
      }
    };

    return (
      <Card 
        className={`overflow-hidden hover:shadow-md transition-shadow ${clickable ? 'cursor-pointer' : ''}`}
        onClick={handleCardClick}
      >
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="relative">
            <Image
              src={like.imageUrl}
              alt={like.name}
              width={80}
              height={80}
              className="rounded-lg object-cover"
            />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{like.name}</h3>
              <span className="text-sm text-gray-500">{like.age}歳</span>
            </div>
            
            {like.location && (
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                <MapPin className="h-3 w-3" />
                <span>{like.location}</span>
              </div>
            )}
            
            {like.isGirlProfile && (
              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800 mb-1">
                店舗在籍
              </div>
            )}
            
            {like.bio && (
              <p className="text-sm text-gray-600 line-clamp-2">{like.bio}</p>
            )}
            
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatDate(like.createdAt)}</span>
            </div>
          </div>
          
          {showLikeButton && !like.isGirlProfile && (
            <div>
              {likedBackUsers.has(like.userId) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="text-gray-500 border-gray-300"
                >
                  <Heart className="h-4 w-4 mr-1 fill-gray-400 text-gray-400" />
                  いいね済み
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-[#F0306A] hover:bg-[#E02860]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLikeBack(like);
                  }}
                  disabled={processingLikes.has(like.userId)}
                >
                  {processingLikes.has(like.userId) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4 mr-1" />
                      いいねを返す
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-center mb-6">マッチ</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="matches" className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            マッチ ({displayMatches.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            送った ({sentLikes.length})
          </TabsTrigger>
          <TabsTrigger value="received" className="flex items-center gap-1">
            <Heart className="h-4 w-4" fill="currentColor" />
            もらった ({receivedLikes.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="matches" className="space-y-3 mt-6">
          {displayMatches.length > 0 ? (
            displayMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))
          ) : (
            <Card className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">まだマッチがありません</p>
              <p className="text-sm text-gray-400 mt-1">プロフィールを充実させて、いいねを送ってみましょう！</p>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="sent" className="space-y-3 mt-6">
          {sentLikes.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                あなたが「いいね」を送った人たちです。
              </p>
              {sentLikes.map(like => (
                <LikeCard key={like.id} like={like} clickable={true} />
              ))}
            </>
          ) : (
            <Card className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">まだいいねを送っていません</p>
              <p className="text-sm text-gray-400 mt-1">気になる人を見つけて、いいねを送ってみましょう！</p>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="received" className="space-y-3 mt-6">
          {receivedLikes.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                あなたに「いいね」を送った人たちです。いいねを返してマッチしましょう！
              </p>
              {receivedLikes.map(like => (
                <LikeCard key={like.id} like={like} showLikeButton={true} clickable={true} />
              ))}
            </>
          ) : (
            <Card className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="currentColor" />
              <p className="text-gray-500">まだいいねをもらっていません</p>
              <p className="text-sm text-gray-400 mt-1">プロフィールを充実させて、もっと多くの人に見てもらいましょう！</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}