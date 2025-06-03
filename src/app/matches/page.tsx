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
        console.log('Sent likes count:', sentLikesSnapshot.size);
        const sentLikeUserIds = sentLikesSnapshot.docs.map(doc => doc.data().to);
        
        // Load received likes (without orderBy to avoid index requirement initially)
        const receivedLikesQuery = query(
          collection(db, 'likes'),
          where('to', '==', currentUser.uid)
        );
        const receivedLikesSnapshot = await getDocs(receivedLikesQuery);
        console.log('Received likes count:', receivedLikesSnapshot.size);
        const receivedLikeUserIds = receivedLikesSnapshot.docs.map(doc => doc.data().from);
        
        // Fetch all user profiles
        const allUserIds = [...new Set([...sentLikeUserIds, ...receivedLikeUserIds])];
        const allUserProfiles = await fetchUserProfiles(allUserIds);
        
        // Process sent likes
        const sentLikesList: Like[] = sentLikesSnapshot.docs.map(doc => {
          const data = doc.data();
          const userProfile = allUserProfiles.get(data.to);
          return {
            id: doc.id,
            userId: data.to,
            name: userProfile?.username || 'ユーザー',
            age: userProfile?.age || 20,
            imageUrl: userProfile?.profilePhotoUrl || 'https://placehold.co/200x200/F0306A/FFF.png?text=U',
            bio: userProfile?.bio,
            location: userProfile?.location,
            createdAt: data.createdAt?.toDate() || new Date(),
            type: 'sent' as const
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by date desc
        
        // Process received likes
        const receivedLikesList: Like[] = receivedLikesSnapshot.docs.map(doc => {
          const data = doc.data();
          const userProfile = allUserProfiles.get(data.from);
          return {
            id: doc.id,
            userId: data.from,
            name: userProfile?.username || 'ユーザー',
            age: userProfile?.age || 20,
            imageUrl: userProfile?.profilePhotoUrl || 'https://placehold.co/200x200/F0306A/FFF.png?text=U',
            bio: userProfile?.bio,
            location: userProfile?.location,
            createdAt: data.createdAt?.toDate() || new Date(),
            type: 'received' as const
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by date desc
        
        setSentLikes(sentLikesList);
        setReceivedLikes(receivedLikesList);
        
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
              <p className="text-sm text-gray-600 truncate">{match.lastMessage}</p>
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
    if (isProcessingLike || !currentUser) return;
    
    console.log('Sending like back to:', like.userId);
    setIsProcessingLike(true);
    
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
        
        // Remove from received likes
        setReceivedLikes(prev => prev.filter(l => l.userId !== like.userId));
        
        // Reload to update matches list
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast({
          title: "いいねを返しました！",
          description: `${like.name}さんにいいねを返しました。`,
        });
        
        // Remove from received likes list
        setReceivedLikes(prev => prev.filter(l => l.userId !== like.userId));
        
        // Add to sent likes list
        const newSentLike: Like = {
          ...like,
          type: 'sent' as const,
          createdAt: new Date()
        };
        setSentLikes(prev => [newSentLike, ...prev]);
      }
    } catch (error) {
      console.error('Error sending like back:', error);
      toast({
        title: "エラー",
        description: "いいねの送信に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsProcessingLike(false);
    }
  };

  const LikeCard = ({ like, showLikeButton = false }: { like: Like; showLikeButton?: boolean }) => (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
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
            
            {like.bio && (
              <p className="text-sm text-gray-600 line-clamp-2">{like.bio}</p>
            )}
            
            <div className="flex items-center gap-1 mt-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatDate(like.createdAt)}</span>
            </div>
          </div>
          
          {showLikeButton && (
            <Button
              size="sm"
              className="bg-[#F0306A] hover:bg-[#E02860]"
              onClick={() => handleLikeBack(like)}
              disabled={isProcessingLike}
            >
              <Heart className="h-4 w-4 mr-1" />
              いいねを返す
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
                <LikeCard key={like.id} like={like} />
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
                <LikeCard key={like.id} like={like} showLikeButton={true} />
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