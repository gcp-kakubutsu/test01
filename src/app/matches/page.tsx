"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, MessageCircle, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Match {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  matchedAt: string;
  lastMessage?: string;
  isNew?: boolean;
}

// Mock data
const mockMatches: Match[] = [
  {
    id: '1',
    name: 'さくら',
    age: 25,
    imageUrl: 'https://placehold.co/200x200/FFB6C1/FFFFFF?text=S',
    matchedAt: '2024-06-01',
    lastMessage: 'こんにちは！よろしくお願いします😊',
    isNew: true
  },
  {
    id: '2',
    name: 'ゆい',
    age: 27,
    imageUrl: 'https://placehold.co/200x200/87CEEB/FFFFFF?text=Y',
    matchedAt: '2024-05-30',
    lastMessage: '週末はどんな過ごし方してますか？'
  },
  {
    id: '3',
    name: 'あかり',
    age: 24,
    imageUrl: 'https://placehold.co/200x200/DDA0DD/FFFFFF?text=A',
    matchedAt: '2024-05-28'
  }
];

const mockLikes: Match[] = [
  {
    id: '4',
    name: 'みお',
    age: 26,
    imageUrl: 'https://placehold.co/200x200/98FB98/FFFFFF?text=M',
    matchedAt: '2024-06-02',
    isNew: true
  },
  {
    id: '5',
    name: 'ひなた',
    age: 23,
    imageUrl: 'https://placehold.co/200x200/F0E68C/FFFFFF?text=H',
    matchedAt: '2024-06-01'
  }
];

export default function MatchesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('matches');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP');
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
            マッチ中 ({mockMatches.length})
          </TabsTrigger>
          <TabsTrigger value="likes" className="flex items-center gap-2">
            <Heart className="h-4 w-4" fill="currentColor" />
            いいねされた ({mockLikes.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="matches" className="space-y-3 mt-6">
          {mockMatches.length > 0 ? (
            mockMatches.map(match => (
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
          {mockLikes.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                あなたに「いいね」を送った人たちです。いいねを返してマッチしましょう！
              </p>
              {mockLikes.map(like => (
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