"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Users, MessageSquare, Heart, Plus, Search, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  imageUrl: string;
  isJoined?: boolean;
  latestPost?: {
    author: string;
    content: string;
    timestamp: string;
  };
}

interface Post {
  id: string;
  author: string;
  authorImage: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

// Mock data
const mockCommunities: Community[] = [
  {
    id: '1',
    name: 'カフェ巡り好きの会',
    description: '全国のおしゃれカフェ情報をシェアしましょう☕️',
    memberCount: 1234,
    category: 'グルメ',
    imageUrl: 'https://placehold.co/400x200/8B4513/FFFFFF?text=Cafe',
    isJoined: true,
    latestPost: {
      author: 'さくら',
      content: '渋谷の新しいカフェ、すごく良かったです！',
      timestamp: '2時間前'
    }
  },
  {
    id: '2',
    name: 'アウトドア愛好会',
    description: 'キャンプ、登山、BBQなどアウトドア情報交換',
    memberCount: 856,
    category: 'アウトドア',
    imageUrl: 'https://placehold.co/400x200/228B22/FFFFFF?text=Outdoor',
    latestPost: {
      author: 'ゆうた',
      content: '富士山の朝焼けが最高でした！',
      timestamp: '5時間前'
    }
  },
  {
    id: '3',
    name: '映画好きが集まる部屋',
    description: '最新映画から名作まで、映画の話で盛り上がろう',
    memberCount: 2045,
    category: 'エンタメ',
    imageUrl: 'https://placehold.co/400x200/4B0082/FFFFFF?text=Movie',
    isJoined: true
  }
];

const mockPosts: Post[] = [
  {
    id: '1',
    author: 'みく',
    authorImage: 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=M',
    content: '今日は代官山の新しいカフェに行ってきました！テラス席がとても気持ち良くて、抹茶ラテも美味しかったです🍵',
    timestamp: '30分前',
    likes: 24,
    comments: 5,
    isLiked: true
  },
  {
    id: '2',
    author: 'たくや',
    authorImage: 'https://placehold.co/40x40/87CEEB/FFFFFF?text=T',
    content: '週末のキャンプ、天気も良くて最高でした！星空がきれいで、みんなで焚き火を囲んで語り合った時間が忘れられません✨',
    timestamp: '2時間前',
    likes: 45,
    comments: 12
  }
];

export default function CommunityPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>('1');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const handleJoinCommunity = (communityId: string) => {
    console.log('Join community:', communityId);
    // In real app, update the community membership
  };

  const handleLikePost = (postId: string) => {
    console.log('Like post:', postId);
    // In real app, update the post likes
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">コミュニティ</h1>
        <Button 
          className="bg-[#F0306A] hover:bg-[#E02860]"
          onClick={() => setShowNewPost(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          投稿する
        </Button>
      </div>

      {/* Search Bar */}
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

      {/* Communities Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {mockCommunities.map(community => (
          <Card 
            key={community.id} 
            className={`cursor-pointer hover:shadow-lg transition-shadow ${
              selectedCommunity === community.id ? 'ring-2 ring-[#F0306A]' : ''
            }`}
            onClick={() => setSelectedCommunity(community.id)}
          >
            <div className="relative h-32">
              <Image
                src={community.imageUrl}
                alt={community.name}
                fill
                className="object-cover rounded-t-lg"
              />
              <Badge className="absolute top-2 right-2 bg-white/90 text-black">
                {community.category}
              </Badge>
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{community.name}</CardTitle>
              <p className="text-sm text-gray-600">{community.description}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{community.memberCount}人</span>
                </div>
                {community.isJoined ? (
                  <Badge variant="secondary">参加中</Badge>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinCommunity(community.id);
                    }}
                  >
                    参加する
                  </Button>
                )}
              </div>
              {community.latestPost && (
                <div className="text-xs text-gray-500 border-t pt-2">
                  <p className="font-medium">{community.latestPost.author}</p>
                  <p className="truncate">{community.latestPost.content}</p>
                  <p className="text-gray-400">{community.latestPost.timestamp}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Community Posts */}
      {selectedCommunity && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#F0306A]" />
            最新の投稿
          </h2>

          {/* New Post Form */}
          {showNewPost && (
            <Card className="p-4">
              <Textarea
                placeholder="何か投稿してみましょう..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="mb-3"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewPost(false)}>
                  キャンセル
                </Button>
                <Button 
                  className="bg-[#F0306A] hover:bg-[#E02860]"
                  onClick={() => {
                    console.log('Post:', newPostContent);
                    setNewPostContent('');
                    setShowNewPost(false);
                  }}
                >
                  投稿
                </Button>
              </div>
            </Card>
          )}

          {/* Posts List */}
          {mockPosts.map(post => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Image
                    src={post.authorImage}
                    alt={post.author}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{post.author}</span>
                      <span className="text-sm text-gray-500">{post.timestamp}</span>
                    </div>
                    <p className="text-gray-700 mb-3">{post.content}</p>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1 ${post.isLiked ? 'text-[#F0306A]' : ''}`}
                        onClick={() => handleLikePost(post.id)}
                      >
                        <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                        <span>{post.likes}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{post.comments}</span>
                      </Button>
                    </div>
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