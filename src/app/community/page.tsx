"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Users, MessageSquare, Heart, Plus, Search, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

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
  latestPost?: {
    author: string;
    content: string;
    timestamp: string;
  };
}

interface Post {
  id: string;
  author: string;
  authorId: string;
  authorImage: string;
  content: string;
  timestamp: any;
  likes: number;
  comments: number;
  communityId: string;
  isLiked?: boolean;
  likedBy?: string[];
}

// Helper function to format timestamp
const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
};

export default function CommunityPage() {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch communities from Firebase
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const fetchCommunities = async () => {
      try {
        setLoadingCommunities(true);
        if (!db) throw new Error('Firestore is not initialized');
        const communitiesRef = collection(db, 'communities');
        const communitiesQuery = query(communitiesRef, orderBy('memberCount', 'desc'));
        
        const unsubscribe = onSnapshot(communitiesQuery, 
          (snapshot) => {
            const communitiesData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                isJoined: data.members?.includes(currentUser.uid) || false
              } as Community;
            });
            setCommunities(communitiesData);
            setLoadingCommunities(false);
            
            // Set first community as selected if none selected
            if (!selectedCommunity && communitiesData.length > 0) {
              setSelectedCommunity(communitiesData[0].id);
            }
          },
          (error) => {
            console.error('Error fetching communities:', error);
            setLoadingCommunities(false);
            
            // Handle permission errors specifically
            const firebaseError = error as any;
            if (firebaseError.code === 'permission-denied') {
              // Check if user is still authenticated
              if (!currentUser) {
                // User has logged out, this is expected - don't show error
                return;
              }
              toast({
                title: "アクセス権限がありません",
                description: "コミュニティデータにアクセスする権限がありません。管理者にお問い合わせください。",
                variant: "destructive",
              });
            } else {
              toast({
                title: "エラー",
                description: "コミュニティの読み込みに失敗しました。",
                variant: "destructive",
              });
            }
            setCommunities([]);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up communities listener:', error);
        setLoadingCommunities(false);
        setCommunities([]);
        toast({
          title: "エラー",
          description: "コミュニティの読み込みに失敗しました。",
          variant: "destructive",
        });
      }
    };

    fetchCommunities();
  }, [isAuthenticated, currentUser, selectedCommunity, toast]);

  // Fetch posts for selected community
  useEffect(() => {
    if (!selectedCommunity || !currentUser) return;

    const fetchPosts = async () => {
      try {
        setLoadingPosts(true);
        if (!db) throw new Error('Firestore is not initialized');
        const postsRef = collection(db, 'posts');
        const postsQuery = query(
          postsRef,
          where('communityId', '==', selectedCommunity),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        
        const unsubscribe = onSnapshot(postsQuery, 
          (snapshot) => {
            const postsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                isLiked: data.likedBy?.includes(currentUser?.uid) || false
              } as Post;
            });
            setPosts(postsData);
            setLoadingPosts(false);
          },
          (error) => {
            console.error('Error fetching posts:', error);
            setLoadingPosts(false);
            
            // Handle permission errors specifically
            if (error.code === 'permission-denied') {
              toast({
                title: "投稿へのアクセス権限がありません",
                description: "このコミュニティの投稿にアクセスする権限がありません。",
                variant: "destructive",
              });
            } else {
              toast({
                title: "エラー",
                description: "投稿の読み込みに失敗しました。",
                variant: "destructive",
              });
            }
            setPosts([]);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up posts listener:', error);
        setLoadingPosts(false);
        setPosts([]);
        toast({
          title: "エラー",
          description: "投稿の読み込みに失敗しました。",
          variant: "destructive",
        });
      }
    };

    fetchPosts();
  }, [selectedCommunity, currentUser, toast]);

  const handleJoinCommunity = async (communityId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const communityRef = doc(db, 'communities', communityId);
      const community = communities.find(c => c.id === communityId);
      
      if (!community) return;
      
      if (community.isJoined) {
        // Leave community
        await updateDoc(communityRef, {
          members: community.members?.filter(uid => uid !== currentUser.uid) || [],
          memberCount: increment(-1)
        });
        toast({
          title: "コミュニティから退会しました",
          description: `${community.name}から退会しました。`,
        });
      } else {
        // Join community
        await updateDoc(communityRef, {
          members: [...(community.members || []), currentUser.uid],
          memberCount: increment(1)
        });
        toast({
          title: "コミュニティに参加しました",
          description: `${community.name}に参加しました。`,
        });
      }
    } catch (error: any) {
      console.error('Error updating community membership:', error);
      
      let errorMessage = "コミュニティの参加状況を更新できませんでした。";
      if (error.code === 'permission-denied') {
        errorMessage = "このコミュニティへの参加権限がありません。";
      } else if (error.code === 'not-found') {
        errorMessage = "コミュニティが見つかりませんでした。";
      }
      
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);
      
      if (!post) return;
      
      if (post.isLiked) {
        // Unlike post
        await updateDoc(postRef, {
          likedBy: post.likedBy?.filter(uid => uid !== currentUser.uid) || [],
          likes: increment(-1)
        });
      } else {
        // Like post
        await updateDoc(postRef, {
          likedBy: [...(post.likedBy || []), currentUser.uid],
          likes: increment(1)
        });
      }
    } catch (error: any) {
      console.error('Error updating post like:', error);
      
      let errorMessage = "いいねの更新に失敗しました。";
      if (error.code === 'permission-denied') {
        errorMessage = "この投稿にいいねする権限がありません。";
      } else if (error.code === 'not-found') {
        errorMessage = "投稿が見つかりませんでした。";
      }
      
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCreatePost = async () => {
    if (!currentUser || !selectedCommunity || !newPostContent.trim()) return;
    
    setIsPosting(true);
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const postsRef = collection(db, 'posts');
      await addDoc(postsRef, {
        authorId: currentUser.uid,
        author: currentUser.displayName || 'Anonymous',
        authorImage: currentUser.photoURL || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
        content: newPostContent,
        communityId: selectedCommunity,
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        likedBy: []
      });
      
      setNewPostContent('');
      setShowNewPost(false);
      
      toast({
        title: "投稿しました",
        description: "投稿が正常に作成されました。",
      });
    } catch (error: any) {
      console.error('Error creating post:', error);
      
      let errorMessage = "投稿の作成に失敗しました。";
      if (error.code === 'permission-denied') {
        errorMessage = "投稿する権限がありません。コミュニティに参加してから投稿してください。";
      } else if (error.code === 'unauthenticated') {
        errorMessage = "認証が必要です。再度ログインしてください。";
      }
      
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">コミュニティ</h1>
        <Button 
          className="bg-[#F0306A] hover:bg-[#E02860]"
          onClick={() => setShowNewPost(true)}
          disabled={!selectedCommunity}
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
        {loadingCommunities ? (
          <div className="col-span-2 flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2">コミュニティを読み込み中...</p>
          </div>
        ) : communities.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">コミュニティがありません</h3>
            <p className="text-sm">まだコミュニティが作成されていないか、アクセス権限がない可能性があります。</p>
            <p className="text-sm mt-2">管理者にお問い合わせください。</p>
          </div>
        ) : (
          communities.map(community => (
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
                    <p className="line-clamp-2">{community.latestPost.content}</p>
                    <p className="text-gray-400">{community.latestPost.timestamp}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
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
                  onClick={handleCreatePost}
                  disabled={isPosting || !newPostContent.trim()}
                >
                  {isPosting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      投稿中...
                    </>
                  ) : (
                    '投稿'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Posts List */}
          {loadingPosts ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">投稿を読み込み中...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>まだ投稿がありません。最初の投稿をしてみましょう！</p>
            </div>
          ) : (
            posts.map(post => (
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
                        <span className="text-sm text-gray-500">{formatTimestamp(post.timestamp)}</span>
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
            ))
          )}
        </div>
      )}
    </div>
  );
}