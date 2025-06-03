"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, MessageCircle, Clock, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMatches, fetchUserProfiles } from '@/lib/firebase/hooks';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Match {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  matchedAt: Date;
  lastMessage?: string;
  isNew?: boolean;
}

export default function MatchesPage() {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { matches, loading: matchesLoading } = useMatches();
  const [activeTab, setActiveTab] = useState('matches');
  const [displayMatches, setDisplayMatches] = useState<Match[]>([]);
  const [displayLikes, setDisplayLikes] = useState<Match[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Convert Firebase matches to display format
  useEffect(() => {
    const loadMatches = async () => {
      if (!currentUser || matchesLoading) return;
      
      setIsLoadingData(true);
      
      // Get all other user IDs from matches
      const otherUserIds = matches.map(match => 
        match.users.find(uid => uid !== currentUser.uid)
      ).filter(Boolean) as string[];
      
      // Fetch user profiles
      const userProfiles = await fetchUserProfiles(otherUserIds);
      
      // Convert to display format
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
          isNew: match.status === 'pending'
        };
      });
      
      // Separate matches and likes based on status
      const activeMatches = matchList.filter(m => {
        const match = matches.find(ma => ma.id === m.id);
        return match?.status === 'matched';
      });
      
      const pendingLikes = matchList.filter(m => {
        const match = matches.find(ma => ma.id === m.id);
        return match?.status === 'pending' && match?.initiator !== currentUser.uid;
      });
      
      setDisplayMatches(activeMatches);
      setDisplayLikes(pendingLikes);
      setIsLoadingData(false);
    };
    
    loadMatches();
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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-center mb-6">マッチ</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            マッチ中 ({displayMatches.length})
          </TabsTrigger>
          <TabsTrigger value="likes" className="flex items-center gap-2">
            <Heart className="h-4 w-4" fill="currentColor" />
            いいねされた ({displayLikes.length})
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
        
        <TabsContent value="likes" className="space-y-3 mt-6">
          {displayLikes.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                あなたに「いいね」を送った人たちです。いいねを返してマッチしましょう！
              </p>
              {displayLikes.map(like => (
                <MatchCard key={like.id} match={like} showMessage={false} />
              ))}
            </>
          ) : (
            <Card className="p-8 text-center">
              <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="currentColor" />
              <p className="text-gray-500">まだいいねがありません</p>
              <p className="text-sm text-gray-400 mt-1">プロフィールを充実させて、もっと多くの人に見てもらいましょう！</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}