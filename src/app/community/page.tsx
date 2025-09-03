"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, MessageSquare, Heart, Plus, Search, TrendingUp, Loader2, Trash2, 
  PlusCircle, Upload, Camera, X, Home, Bell, Mail, User, MoreHorizontal, 
  Share, Repeat, Edit3, Bookmark, Menu
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db, functions, storage } from '@/lib/firebase/client';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeCommunityCollections } from '@/lib/firebase/init-community';
import { useSubscription } from '@/contexts/SubscriptionContext';
import PremiumOnlyCard from '@/components/PremiumOnlyCard';
import { getPremiumMessage } from '@/config/premium-messages';
import { useUserProfile, useTrends, type UserProfile as UserProfileType } from '@/lib/firebase/hooks';

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
  retweets: number;
  communityId: string;
  isLiked?: boolean;
  isRetweeted?: boolean;
  likedBy?: string[];
  retweetedBy?: string[];
  commentsList?: Comment[];
  originalPost?: Post;
  retweetedAuthor?: string;
  retweetedAuthorId?: string;
  retweetedAt?: any;
}

interface Comment {
  id: string;
  author: string;
  authorId: string;
  authorImage: string;
  content: string;
  timestamp: any;
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
  const { isAuthenticated, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPremium: isPremium, isLoading: subscriptionLoading } = useSubscription();
  const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [postDestination, setPostDestination] = useState<string>('global');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityCategory, setNewCommunityCategory] = useState('');
  const [newCommunityImage, setNewCommunityImage] = useState('');
  const [newCommunityImageFile, setNewCommunityImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const { profile } = useUserProfile();
  const postFormRef = useRef<HTMLDivElement>(null);
  const { trends, loading: trendsLoading } = useTrends(5);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [showJoinButton, setShowJoinButton] = useState(false);
  
  // モバイルの左/右サイドバー表示中は背面（本文）のスクロールを完全に無効化（iOS対応の固定化方式）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const overlayOpen = isRightSidebarOpen || isMobileMenuOpen;
    const body = document.body as HTMLBodyElement;
    const html = document.documentElement as HTMLElement;
    const prev = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyTouchAction: (body.style as any).touchAction as string | undefined,
    };
    if (overlayOpen) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      // iOSで確実に背景を固定
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      (body.style as any).touchAction = 'none';
      (body.dataset as any).lockScrollY = String(scrollY);
    } else {
      // 復元
      const y = Number((body.dataset as any).lockScrollY || 0);
      body.style.position = prev.bodyPosition || '';
      body.style.top = prev.bodyTop || '';
      body.style.left = prev.bodyLeft || '';
      body.style.right = prev.bodyRight || '';
      body.style.width = prev.bodyWidth || '';
      body.style.overflow = prev.bodyOverflow || '';
      html.style.overflow = prev.htmlOverflow || '';
      (body.style as any).touchAction = prev.bodyTouchAction || '';
      if (y) {
        window.scrollTo(0, y);
      }
      delete (body.dataset as any).lockScrollY;
    }
    return () => {
      // 念のため復元
      body.style.position = prev.bodyPosition || '';
      body.style.top = prev.bodyTop || '';
      body.style.left = prev.bodyLeft || '';
      body.style.right = prev.bodyRight || '';
      body.style.width = prev.bodyWidth || '';
      body.style.overflow = prev.bodyOverflow || '';
      html.style.overflow = prev.htmlOverflow || '';
      (body.style as any).touchAction = prev.bodyTouchAction || '';
    };
  }, [isRightSidebarOpen, isMobileMenuOpen]);
  
  // Check if current user is admin
  const isAdmin = currentUser?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(currentUser.email);
  const [hasInitialized, setHasInitialized] = useState(false);

  // 初回のみコミュニティコレクションを初期化
  useEffect(() => {
    if (!currentUser || hasInitialized || subscriptionLoading) return;
    
    const initCommunity = async () => {
      try {
        if (typeof initializeCommunityCollections === 'function') {
          await initializeCommunityCollections();
          console.log('Community collections initialized');
        }
      } catch (error) {
        console.error('Error initializing community collections:', error);
      }
      setHasInitialized(true);
    };
    
    initCommunity();
  }, [currentUser, hasInitialized, subscriptionLoading]);

  // Check premium status
  useEffect(() => {
    if (!subscriptionLoading && !isPremium) {
      // User is not premium, don't initialize or fetch community data
      console.log('Community is premium-only feature');
    }
  }, [subscriptionLoading, isPremium]);

  // Fetch communities from Firebase (Premium only)
  useEffect(() => {
    if (subscriptionLoading) return;
    
    if (!currentUser || (!isPremium && !subscriptionLoading)) {
      setLoadingCommunities(false);
      setLoadingPosts(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const fetchCommunities = async () => {
      try {
        setLoadingCommunities(true);
        
        if (!db) {
          console.log('Firestore not initialized yet, waiting...');
          setTimeout(() => {
            if (isMounted) fetchCommunities();
          }, 500);
          return;
        }
        
        if (!isMounted || !currentUser) {
          console.log('Component unmounted or user not authenticated');
          setLoadingCommunities(false);
          return;
        }
        
        const communitiesRef = collection(db, 'communities');
        const communitiesQuery = query(communitiesRef, orderBy('memberCount', 'desc'));
        
        unsubscribe = onSnapshot(communitiesQuery, 
          (snapshot) => {
            if (!isMounted || !currentUser) {
              console.log('Component unmounted during snapshot');
              return;
            }
            
            const communitiesData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                isJoined: data.members?.includes(currentUser.uid) || false
              } as Community;
            });
            setCommunities(communitiesData);
            
            // ユーザーが参加しているコミュニティのIDリストを作成
            const joined = communitiesData
              .filter(c => c.isJoined)
              .map(c => c.id);
            setJoinedCommunities(joined);
            
            setLoadingCommunities(false);
          },
          (error) => {
            if (!isMounted) return;
            console.error('Error fetching communities:', error);
            setLoadingCommunities(false);
            setCommunities([]);
          }
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Error setting up communities listener:', error);
        setLoadingCommunities(false);
        setCommunities([]);
      }
    };

    fetchCommunities();
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, isPremium, subscriptionLoading]);

  // Fetch posts (Premium only)
  useEffect(() => {
    if (subscriptionLoading) return;
    
    if (!currentUser || (!isPremium && !subscriptionLoading)) return;

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const fetchPosts = async () => {
      try {
        setLoadingPosts(true);
        
        if (!db) {
          console.log('Firestore not initialized yet for posts, waiting...');
          setTimeout(() => {
            if (isMounted) fetchPosts();
          }, 500);
          return;
        }
        
        if (!isMounted || !currentUser) {
          console.log('Component unmounted or user not authenticated (posts)');
          setLoadingPosts(false);
          return;
        }
        
        const postsRef = collection(db, 'posts');
        let postsQuery;
        
        try {
          if (selectedCommunity) {
            postsQuery = query(
              postsRef,
              where('communityId', '==', selectedCommunity),
              orderBy('timestamp', 'desc'),
              limit(50)
            );
          } else {
            postsQuery = query(
              postsRef,
              where('communityId', '==', 'global'),
              orderBy('timestamp', 'desc'),
              limit(50)
            );
          }
        } catch (error) {
          console.log('Compound index not available, using simple query');
          if (selectedCommunity) {
            postsQuery = query(
              postsRef,
              where('communityId', '==', selectedCommunity),
              limit(50)
            );
          } else {
            postsQuery = query(
              postsRef,
              where('communityId', '==', 'global'),
              limit(50)
            );
          }
        }
        
        unsubscribe = onSnapshot(postsQuery, 
          async (snapshot) => {
            if (!isMounted || !currentUser) return;
            
            const postsData = await Promise.all(
              snapshot.docs.map(async (doc) => {
                const data = doc.data();
                
                if (!db) throw new Error('Firestore not initialized');
                const commentsRef = collection(db, 'posts', doc.id, 'comments');
                const commentsQuery = query(commentsRef, orderBy('timestamp', 'desc'), limit(10));
                const commentsSnapshot = await getDocs(commentsQuery);
                
                const comments = commentsSnapshot.docs.map(commentDoc => ({
                  id: commentDoc.id,
                  ...commentDoc.data()
                } as Comment));
                
                return {
                  id: doc.id,
                  ...data,
                  isLiked: data.likedBy?.includes(currentUser?.uid) || false,
                  isRetweeted: data.retweetedBy?.includes(currentUser?.uid) || false,
                  retweets: data.retweets || 0,
                  retweetedBy: data.retweetedBy || [],
                  commentsList: comments
                } as Post;
              })
            );
            setPosts(postsData);
            setLoadingPosts(false);
          },
          (error: any) => {
            if (!isMounted) return;
            console.error('Error fetching posts:', error);
            setLoadingPosts(false);
            setPosts([]);
          }
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Error setting up posts listener:', error);
        setLoadingPosts(false);
        setPosts([]);
      }
    };

    fetchPosts();
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunity, currentUser?.uid, isPremium, subscriptionLoading]);

  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId || p.originalPost?.id === postId);
      
      if (!post) return;
      
      // Use original post ID if this is a retweet
      const targetPostId = post.originalPost ? post.originalPost.id : postId;
      const targetPostRef = doc(db, 'posts', targetPostId);
      
      if (post.isLiked) {
        await updateDoc(targetPostRef, {
          likedBy: post.likedBy?.filter(uid => uid !== currentUser.uid) || [],
          likes: increment(-1)
        });
      } else {
        await updateDoc(targetPostRef, {
          likedBy: [...(post.likedBy || []), currentUser.uid],
          likes: increment(1)
        });
        
        // 通知を作成（自分の投稿でない場合のみ）
        const targetAuthorId = post.originalPost ? post.originalPost.authorId : post.authorId;
        if (targetAuthorId !== currentUser.uid) {
          const notificationRef = collection(db, 'users', targetAuthorId, 'notifications');
          await addDoc(notificationRef, {
            type: 'like',
            fromUserId: currentUser.uid,
            fromUserName: profile?.username || currentUser.displayName || 'Anonymous',
            fromUserImage: profile?.profilePhotoUrl || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
            postId: targetPostId,
            postContent: post.originalPost ? post.originalPost.content : post.content,
            timestamp: serverTimestamp(),
            isRead: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error: any) {
      console.error('Error updating post like:', error);
      toast({
        title: "エラー",
        description: "いいねの更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleRetweetPost = async (postId: string) => {
    if (!currentUser) return;
    
    if (!isPremium && !subscriptionLoading) {
      toast({
        title: "プレミアム機能",
        description: "リツイート機能はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const post = posts.find(p => p.id === postId || p.originalPost?.id === postId);
      
      if (!post) return;
      
      // Use original post data if this is already a retweet
      const originalPost = post.originalPost || post;
      
      // Check if user has already retweeted
      const userHasRetweeted = originalPost.retweetedBy?.includes(currentUser.uid) || false;
      
      if (userHasRetweeted || post.isRetweeted) {
        // Remove retweet
        const retweetQuery = query(
          collection(db, 'posts'),
          where('originalPost.id', '==', originalPost.id),
          where('authorId', '==', currentUser.uid)
        );
        const retweetSnapshot = await getDocs(retweetQuery);
        
        if (!retweetSnapshot.empty) {
          const retweetDoc = retweetSnapshot.docs[0];
          await deleteDoc(doc(db, 'posts', retweetDoc.id));
        }
        
        // Update original post retweet count
        const postRef = doc(db, 'posts', originalPost.id);
        await updateDoc(postRef, {
          retweetedBy: originalPost.retweetedBy?.filter(uid => uid !== currentUser.uid) || [],
          retweets: increment(-1)
        });
        
        toast({
          title: "リツイートを取り消しました",
          description: "リツイートが取り消されました。",
        });
      } else {
        // Check if user has already retweeted (prevent duplicate retweets)
        const existingRetweetQuery = query(
          collection(db, 'posts'),
          where('originalPost.id', '==', originalPost.id),
          where('authorId', '==', currentUser.uid)
        );
        const existingRetweetSnapshot = await getDocs(existingRetweetQuery);
        
        if (!existingRetweetSnapshot.empty) {
          toast({
            title: "既にリツイート済みです",
            description: "この投稿は既にリツイートしています。",
            variant: "destructive",
          });
          return;
        }
        
        // Create retweet
        const postsRef = collection(db, 'posts');
        await addDoc(postsRef, {
          authorId: currentUser.uid,
          author: profile?.username || currentUser.displayName || 'Anonymous',
          authorImage: profile?.profilePhotoUrl || 'https://placehold.co/48x48/FFB6C1/FFFFFF?text=U',
          content: '',
          communityId: originalPost.communityId || 'global', // デフォルト値を設定
          timestamp: serverTimestamp(),
          likes: 0,
          comments: 0,
          retweets: 0,
          likedBy: [],
          retweetedBy: [],
          originalPost: {
            id: originalPost.id,
            author: originalPost.author,
            authorId: originalPost.authorId,
            authorImage: originalPost.authorImage,
            content: originalPost.content,
            timestamp: originalPost.timestamp,
            likes: originalPost.likes || 0,
            comments: originalPost.comments || 0,
            retweets: originalPost.retweets || 0,
            communityId: originalPost.communityId || 'global'
          },
          retweetedAuthor: profile?.username || currentUser.displayName || 'Anonymous',
          retweetedAuthorId: currentUser.uid,
          retweetedAt: serverTimestamp()
        });
        
        // Update original post retweet count
        const postRef = doc(db, 'posts', originalPost.id);
        await updateDoc(postRef, {
          retweetedBy: [...(originalPost.retweetedBy || []), currentUser.uid],
          retweets: increment(1)
        });
        
        // 通知を作成（自分の投稿でない場合のみ）
        if (originalPost.authorId !== currentUser.uid) {
          const notificationRef = collection(db, 'users', originalPost.authorId, 'notifications');
          await addDoc(notificationRef, {
            type: 'retweet',
            fromUserId: currentUser.uid,
            fromUserName: profile?.username || currentUser.displayName || 'Anonymous',
            fromUserImage: profile?.profilePhotoUrl || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
            postId: originalPost.id,
            postContent: originalPost.content,
            timestamp: serverTimestamp(),
            isRead: false,
            createdAt: serverTimestamp()
          });
        }
        
        toast({
          title: "リツイートしました",
          description: "投稿をリツイートしました。",
        });
      }
    } catch (error: any) {
      console.error('Error updating post retweet:', error);
      toast({
        title: "エラー",
        description: "リツイートの更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleJoinCommunity = async (communityId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const communityRef = doc(db, 'communities', communityId);
      const community = communities.find(c => c.id === communityId);
      
      if (!community) return;
      
      if (community.isJoined) {
        await updateDoc(communityRef, {
          members: community.members?.filter(uid => uid !== currentUser.uid) || [],
          memberCount: increment(-1)
        });
        toast({
          title: "コミュニティから退会しました",
          description: `${community.name}から退会しました。`,
        });
      } else {
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
      toast({
        title: "エラー",
        description: "コミュニティの参加状況を更新できませんでした。",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !newComment.trim()) return;
    
    if (!isPremium && !subscriptionLoading) {
      toast({
        title: "プレミアム機能",
        description: "コメント機能はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    setIsCommenting(true);
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const newCommentData = {
        authorId: currentUser.uid,
        author: profile?.username || currentUser.displayName || 'Anonymous',
        authorImage: profile?.profilePhotoUrl || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
        content: newComment,
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(commentsRef, newCommentData);
      
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: increment(1)
      });
      
      const newCommentWithId = {
        id: docRef.id,
        ...newCommentData,
        timestamp: new Date()
      };
      
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? {
                ...post,
                comments: post.comments + 1,
                commentsList: [newCommentWithId, ...(post.commentsList || [])]
              }
            : post
        )
      );
      
      setNewComment('');
      
      // 通知を作成（自分の投稿でない場合のみ）
      const post = posts.find(p => p.id === postId);
      const targetAuthorId = post?.originalPost ? post.originalPost.authorId : post?.authorId;
      if (targetAuthorId && targetAuthorId !== currentUser.uid) {
        const notificationRef = collection(db, 'users', targetAuthorId, 'notifications');
        await addDoc(notificationRef, {
          type: 'comment',
          fromUserId: currentUser.uid,
          fromUserName: profile?.username || currentUser.displayName || 'Anonymous',
          fromUserImage: profile?.profilePhotoUrl || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
          postId: postId,
          postContent: post?.originalPost ? post.originalPost.content : post?.content,
          message: newComment,
          timestamp: serverTimestamp(),
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
      
      toast({
        title: "コメントを投稿しました",
        description: "コメントが正常に投稿されました。",
      });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: "エラー",
        description: "コメントの投稿に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const post = posts.find(p => p.id === postId);
      
      if (!post) return;
      
      if (post.authorId === currentUser.uid || isAdmin) {
        const postRef = doc(db, 'posts', postId);
        await deleteDoc(postRef);
        
        toast({
          title: "投稿を削除しました",
          description: "投稿が正常に削除されました。",
        });
      } else {
        toast({
          title: "エラー",
          description: "この投稿を削除する権限がありません。",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        title: "エラー",
        description: "投稿の削除に失敗しました。",
        variant: "destructive",
      });
    }
  };


  const handleFollowUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      // Create a like/follow action
      const likesRef = collection(db, 'likes');
      await addDoc(likesRef, {
        from: currentUser.uid,
        to: userId,
        createdAt: serverTimestamp(),
        type: 'follow'
      });
      
      toast({
        title: "ユーザーをフォローしました",
        description: "プロフィールページで詳しく確認できます。",
      });
    } catch (error: any) {
      console.error('Error following user:', error);
      toast({
        title: "エラー",
        description: "フォローに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleTrendClick = (hashtag: string) => {
    if (!isPremium && !subscriptionLoading) {
      toast({
        title: "プレミアム機能",
        description: "ハッシュタグ検索はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    // Filter posts by hashtag
    setSearchQuery(hashtag);
    toast({
      title: "ハッシュタグでフィルターしました",
      description: `${hashtag} の投稿を表示中です。`,
    });
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const commentSnap = await getDoc(commentRef);
      
      if (!commentSnap.exists()) {
        toast({
          title: "エラー",
          description: "コメントが見つかりません。",
          variant: "destructive",
        });
        return;
      }
      
      const commentData = commentSnap.data();
      
      if (commentData.authorId === currentUser.uid || isAdmin) {
        await deleteDoc(commentRef);
        
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
          comments: increment(-1)
        });
        
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? {
                  ...post,
                  comments: Math.max(0, post.comments - 1),
                  commentsList: post.commentsList?.filter(c => c.id !== commentId)
                }
              : post
          )
        );
        
        toast({
          title: "コメントを削除しました",
          description: "コメントが正常に削除されました。",
        });
      } else {
        toast({
          title: "エラー",
          description: "このコメントを削除する権限がありません。",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast({
        title: "エラー",
        description: "コメントの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleJoinCommunities = async () => {
    if (!currentUser || selectedCommunities.length === 0) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      for (const communityId of selectedCommunities) {
        const community = communities.find(c => c.id === communityId);
        if (!community) continue;
        
        const communityRef = doc(db, 'communities', communityId);
        const members = community.members || [];
        
        if (community.isJoined) {
          // 退会
          await updateDoc(communityRef, {
            members: members.filter(uid => uid !== currentUser.uid),
            memberCount: increment(-1)
          });
        } else {
          // 参加
          await updateDoc(communityRef, {
            members: [...members, currentUser.uid],
            memberCount: increment(1)
          });
        }
      }
      
      setSelectedCommunities([]);
      setShowJoinButton(false);
      
      toast({
        title: "更新完了",
        description: "コミュニティの参加状態を更新しました。",
      });
    } catch (error: any) {
      console.error('Error updating community membership:', error);
      toast({
        title: "エラー",
        description: "コミュニティの参加更新に失敗しました。",
        variant: "destructive",
      });
    }
  };
  
  const handleCommunityCheckboxChange = (communityId: string, checked: boolean) => {
    if (checked) {
      setSelectedCommunities([...selectedCommunities, communityId]);
    } else {
      setSelectedCommunities(selectedCommunities.filter(id => id !== communityId));
    }
    setShowJoinButton(true);
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
      
      // 選択中のコミュニティが削除された場合はリセット
      if (selectedCommunity === communityId) {
        setSelectedCommunity(null);
      }
    } catch (error: any) {
      console.error('Error deleting community:', error);
      toast({
        title: "エラー",
        description: "コミュニティの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleCreateCommunity = async () => {
    if (!currentUser || !newCommunityName.trim() || !newCommunityDescription.trim()) return;
    
    if (!isPremium && !subscriptionLoading) {
      toast({
        title: "プレミアム機能",
        description: "コミュニティ作成はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreatingCommunity(true);
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      let imageUrl = newCommunityImage;
      
      // 画像がアップロードされている場合
      if (newCommunityImageFile) {
        setIsUploadingImage(true);
        try {
          if (!storage) {
            throw new Error('Storage is not initialized');
          }
          const storageRef = ref(storage, `community-images/${Date.now()}_${newCommunityImageFile.name}`);
          const snapshot = await uploadBytes(storageRef, newCommunityImageFile);
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast({
            title: "画像アップロードエラー",
            description: "画像のアップロードに失敗しました。",
            variant: "destructive",
          });
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      if (!imageUrl) {
        imageUrl = 'https://placehold.co/400x200/FFB6C1/FFFFFF?text=' + encodeURIComponent(newCommunityName);
      }
      
      const communitiesRef = collection(db, 'communities');
      await addDoc(communitiesRef, {
        name: newCommunityName,
        description: newCommunityDescription,
        category: newCommunityCategory || '一般',
        imageUrl: imageUrl,
        memberCount: 1,
        members: [currentUser.uid],
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      
      setNewCommunityName('');
      setNewCommunityDescription('');
      setNewCommunityCategory('');
      setNewCommunityImage('');
      setNewCommunityImageFile(null);
      setImagePreview('');
      setShowCreateCommunity(false);
      
      toast({
        title: "コミュニティを作成しました",
        description: `コミュニティが正常に作成されました。`,
      });
    } catch (error: any) {
      console.error('Error creating community:', error);
      toast({
        title: "エラー",
        description: "コミュニティの作成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCommunity(false);
    }
  };
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB制限
        toast({
          title: "ファイルサイズエラー",
          description: "画像は5MB以下にしてください。",
          variant: "destructive",
        });
        return;
      }
      
      setNewCommunityImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!currentUser || !newPostContent.trim()) return;
    
    if (!isPremium && !subscriptionLoading) {
      toast({
        title: "プレミアム機能",
        description: "投稿機能はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    if (postDestination !== 'global') {
      const community = communities.find(c => c.id === postDestination);
      if (!community || !community.isJoined) {
        toast({
          title: "参加が必要",
          description: "このコミュニティに投稿するには参加が必要です。",
          variant: "destructive",
        });
        setPostDestination('global'); // デフォルトに戻す
        return;
      }
    }
    
    setIsPosting(true);
    try {
      if (!db) throw new Error('Firestore is not initialized');
      const postsRef = collection(db, 'posts');
      await addDoc(postsRef, {
        authorId: currentUser.uid,
        author: profile?.username || currentUser.displayName || 'Anonymous',
        authorImage: profile?.profilePhotoUrl || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
        content: newPostContent,
        communityId: postDestination,
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        retweets: 0,
        likedBy: [],
        retweetedBy: []
      });
      
      setNewPostContent('');
      setPostDestination('global');
      setShowNewPost(false);
      
      toast({
        title: "投稿しました",
        description: "投稿が正常に作成されました。",
      });
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: "エラー",
        description: "投稿の作成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (subscriptionLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  if (!isPremium && !subscriptionLoading) {
    const communityMessage = getPremiumMessage('community');
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PremiumOnlyCard 
          title={communityMessage.title}
          description={communityMessage.description}
          buttonText={communityMessage.buttonText}
          features={communityMessage.features}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Right Sidebar Overlay */}
      {isRightSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsRightSidebarOpen(false)}
        />
      )}
      
      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">コミュニティ内を検索</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSearchModal(false);
                    setCommunitySearchQuery('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="投稿を検索..."
                  value={communitySearchQuery}
                  onChange={(e) => setCommunitySearchQuery(e.target.value)}
                  className="pl-10 pr-4"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {communitySearchQuery.trim() === '' ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  検索キーワードを入力してください
                </p>
              ) : (
                <div className="space-y-4">
                  {posts
                    .filter(post => {
                      const content = post.originalPost ? post.originalPost.content : post.content;
                      const author = post.originalPost ? post.originalPost.author : post.author;
                      return content.toLowerCase().includes(communitySearchQuery.toLowerCase()) ||
                             author.toLowerCase().includes(communitySearchQuery.toLowerCase());
                    })
                    .map(post => (
                      <div 
                        key={post.id} 
                        className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                        onClick={() => {
                          setShowSearchModal(false);
                          setCommunitySearchQuery('');
                          // 該当投稿にスクロール
                          const element = document.getElementById(`post-${post.id}`);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 flex-shrink-0">
                            <Image
                              src={post.originalPost ? post.originalPost.authorImage : post.authorImage}
                              alt={post.originalPost ? post.originalPost.author : post.author}
                              width={40}
                              height={40}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm">{post.originalPost ? post.originalPost.author : post.author}</span>
                              <span className="text-xs text-gray-500">{formatTimestamp(post.originalPost ? post.originalPost.timestamp : post.timestamp)}</span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                              {post.originalPost ? post.originalPost.content : post.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                  {posts.filter(post => {
                    const content = post.originalPost ? post.originalPost.content : post.content;
                    const author = post.originalPost ? post.originalPost.author : post.author;
                    return content.toLowerCase().includes(communitySearchQuery.toLowerCase()) ||
                           author.toLowerCase().includes(communitySearchQuery.toLowerCase());
                  }).length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      「{communitySearchQuery}」に一致する投稿が見つかりませんでした
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto flex">
        {/* Left Sidebar - Desktop & Mobile */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 w-64 xl:w-72 flex flex-col overflow-y-scroll overscroll-y-contain pointer-events-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-[60] lg:z-auto p-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]`} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-[#F0306A]">Nukune</h1>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  setSelectedCommunity(null);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Home className="h-6 w-6 mr-4" />
                ホーム
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  setShowSearchModal(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Search className="h-6 w-6 mr-4" />
                探索
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  router.push('/notifications');
                  setIsMobileMenuOpen(false);
                }}
              >
                <Bell className="h-6 w-6 mr-4" />
                通知
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  router.push('/community/list');
                  setIsMobileMenuOpen(false);
                }}
              >
                <Users className="h-6 w-6 mr-4" />
                コミュニティ一覧
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  router.push('/profile');
                  setIsMobileMenuOpen(false);
                }}
              >
                <User className="h-6 w-6 mr-4" />
                プロフィール
              </Button>
            </nav>
            <Button 
              className="w-full mt-8 bg-[#F0306A] hover:bg-[#E02860] text-white text-lg py-3 rounded-full"
              onClick={() => {
                if (!isPremium && !subscriptionLoading) {
                  toast({
                    title: "プレミアム機能",
                    description: "投稿機能はプレミアム会員限定です。",
                    variant: "destructive",
                  });
                  return;
                }
                setShowNewPost(true);
                setIsMobileMenuOpen(false);
                setTimeout(() => {
                  postFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
              disabled={!isPremium && !subscriptionLoading}
            >
              投稿する
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className={`${(isRightSidebarOpen || isMobileMenuOpen) ? 'pointer-events-none touch-none overflow-hidden' : ''} flex-1 lg:ml-64 xl:ml-72 lg:mr-80 xl:mr-96`}>
          <div className="border-x border-gray-200 dark:border-gray-800 min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <Home className="h-5 w-5" />
                </Button>
                
                <h2 className="text-xl font-bold flex-1">ホーム</h2>
                
                {/* Mobile Search Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2"
                  onClick={() => setIsRightSidebarOpen(true)}
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Post Compose */}
            <div className="border-b border-gray-200 dark:border-gray-800 p-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 flex-shrink-0">
                  <Image
                    src={profile?.profilePhotoUrl || 'https://placehold.co/48x48/FFB6C1/FFFFFF?text=U'}
                    alt="Your avatar"
                    width={48}
                    height={48}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  {showNewPost ? (
                    <>
                      <div className="mb-3">
                        <Select
                          value={postDestination}
                          onValueChange={setPostDestination}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="投稿先を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global">全体の投稿</SelectItem>
                            {communities
                              .filter(c => c.isJoined)
                              .map(community => (
                                <SelectItem key={community.id} value={community.id}>
                                  {community.name}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        placeholder="いまどうしてる？"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="mb-3 border-none resize-none text-xl p-0 min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0"
                        rows={3}
                      />
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex gap-4">
                          <button className="text-[#F0306A] hover:bg-[#F0306A]/10 p-2 rounded-full transition-colors">
                            <Camera className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              setShowNewPost(false);
                              setNewPostContent('');
                              setPostDestination('global');
                            }}
                          >
                            キャンセル
                          </Button>
                          <Button 
                            size="sm"
                            className="bg-[#F0306A] hover:bg-[#E02860] text-white px-6 rounded-full"
                            onClick={handleCreatePost}
                            disabled={isPosting || !newPostContent.trim() || (!isPremium && !subscriptionLoading)}
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
                      </div>
                    </>
                  ) : (
                    <>
                      <button 
                        className="w-full text-left text-xl text-gray-500 dark:text-gray-400 py-4 px-0 border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        onClick={() => {
                          if (!isPremium && !subscriptionLoading) {
                            toast({
                              title: "プレミアム機能",
                              description: "投稿機能はプレミアム会員限定です。",
                              variant: "destructive",
                            });
                            return;
                          }
                          setShowNewPost(true);
                        }}
                      >
                        いまどうしてる？
                      </button>
                      <div className="flex justify-between items-center pt-3">
                        <div className="flex gap-4">
                          <button className="text-[#F0306A] hover:bg-[#F0306A]/10 p-2 rounded-full transition-colors">
                            <Camera className="h-5 w-5" />
                          </button>
                        </div>
                        <Button 
                          size="sm"
                          className="bg-[#F0306A] hover:bg-[#E02860] text-white px-6 rounded-full"
                          onClick={() => {
                            if (!isPremium && !subscriptionLoading) {
                              toast({
                                title: "プレミアム機能",
                                description: "投稿機能はプレミアム会員限定です。",
                                variant: "destructive",
                              });
                              return;
                            }
                            setShowNewPost(true);
                          }}
                          disabled={!isPremium && !subscriptionLoading}
                        >
                          投稿
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* New Post Form (inline above) */}

            {/* Create Community Modal */}
            {showCreateCommunity && (
              <div className="border-b border-gray-200 dark:border-gray-800 p-4">
                <Card className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>新しいコミュニティを作成</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 space-y-4">
                    <div>
                      <label className="text-sm font-medium">コミュニティ名</label>
                      <Input
                        placeholder="例: 東京グルメ好きの会"
                        value={newCommunityName}
                        onChange={(e) => setNewCommunityName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">説明</label>
                      <Textarea
                        placeholder="コミュニティの説明を入力..."
                        value={newCommunityDescription}
                        onChange={(e) => setNewCommunityDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">カテゴリ</label>
                      <Input
                        placeholder="例: 趣味, グルメ, スポーツ"
                        value={newCommunityCategory}
                        onChange={(e) => setNewCommunityCategory(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">コミュニティ画像</label>
                      <div className="mt-2 space-y-2">
                        {imagePreview && (
                          <div className="relative w-full h-40 rounded-lg overflow-hidden">
                            <Image
                              src={imagePreview}
                              alt="Community preview"
                              fill
                              className="object-cover"
                            />
                            <button
                              onClick={() => {
                                setImagePreview('');
                                setNewCommunityImageFile(null);
                              }}
                              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <label 
                            htmlFor="community-image-upload" 
                            className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">画像を選択</span>
                            <input
                              id="community-image-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                          </label>
                          {isUploadingImage && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">アップロード中...</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">推奨サイズ: 800x400px, 最大 5MB</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowCreateCommunity(false);
                          setNewCommunityName('');
                          setNewCommunityDescription('');
                          setNewCommunityCategory('');
                        }}
                      >
                        キャンセル
                      </Button>
                      <Button 
                        className="bg-[#F0306A] hover:bg-[#E02860]"
                        onClick={handleCreateCommunity}
                        disabled={isCreatingCommunity || !newCommunityName.trim() || !newCommunityDescription.trim()}
                      >
                        {isCreatingCommunity ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            作成中...
                          </>
                        ) : (
                          '作成'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Timeline */}
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingPosts ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="ml-2">投稿を読み込み中...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <p>まだ投稿がありません。最初の投稿をしてみましょう！</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} id={`post-${post.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer">
                    {/* Retweet indicator */}
                    {post.originalPost && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <Repeat className="h-4 w-4 ml-8" />
                        <span>{post.author} がリツイート</span>
                        <span>·</span>
                        <span>{formatTimestamp(post.retweetedAt || post.timestamp)}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <div className="w-12 h-12 flex-shrink-0">
                        <Image
                          src={post.originalPost ? post.originalPost.authorImage : post.authorImage}
                          alt={post.originalPost ? post.originalPost.author : post.author}
                          width={48}
                          height={48}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="font-bold">{post.originalPost ? post.originalPost.author : post.author}</span>
                          <span className="text-gray-500 dark:text-gray-400">@{(post.originalPost ? post.originalPost.author : post.author).toLowerCase().replace(/\s+/g, '')}</span>
                          <span className="text-gray-500 dark:text-gray-400">·</span>
                          <span className="text-gray-500 dark:text-gray-400">{formatTimestamp(post.originalPost ? post.originalPost.timestamp : post.timestamp)}</span>
                          {((post.originalPost ? post.originalPost.authorId : post.authorId) === currentUser?.uid || isAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePost(post.id)}
                              className="ml-auto text-red-500 hover:text-red-600 p-1 h-auto"
                              title={isAdmin && (post.originalPost ? post.originalPost.authorId : post.authorId) !== currentUser?.uid ? "管理者として削除" : "削除"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Post content */}
                        <div className="mb-3">
                          {post.originalPost ? (
                            <p className="text-gray-900 dark:text-gray-100">{post.originalPost.content}</p>
                          ) : (
                            <p className="text-gray-900 dark:text-gray-100">{post.content}</p>
                          )}
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center justify-between max-w-md mt-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2 hover:bg-blue-50 hover:text-blue-500 text-gray-500 dark:text-gray-400 dark:hover:bg-blue-900/20 p-2 h-auto rounded-full group"
                            onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                          >
                            <MessageSquare className="h-5 w-5 group-hover:bg-blue-500/10 p-1 rounded-full" />
                            <span className="text-sm">{post.comments}</span>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-2 hover:bg-green-50 text-gray-500 dark:text-gray-400 dark:hover:bg-green-900/20 p-2 h-auto rounded-full group ${
                              post.isRetweeted ? 'text-green-500' : 'hover:text-green-500'
                            }`}
                            onClick={() => handleRetweetPost(post.originalPost ? post.originalPost.id : post.id)}
                          >
                            <Repeat className={`h-5 w-5 group-hover:bg-green-500/10 p-1 rounded-full ${post.isRetweeted ? 'text-green-500' : ''}`} />
                            <span className="text-sm">{post.originalPost ? post.originalPost.retweets || 0 : post.retweets}</span>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`gap-2 hover:bg-red-50 text-gray-500 dark:text-gray-400 dark:hover:bg-red-900/20 p-2 h-auto rounded-full group ${
                              post.isLiked ? 'text-red-500' : 'hover:text-red-500'
                            }`}
                            onClick={() => handleLikePost(post.originalPost ? post.originalPost.id : post.id)}
                          >
                            <Heart className={`h-5 w-5 group-hover:bg-red-500/10 p-1 rounded-full ${post.isLiked ? 'fill-current text-red-500' : ''}`} />
                            <span className="text-sm">{post.originalPost ? post.originalPost.likes || 0 : post.likes}</span>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-blue-50 hover:text-blue-500 text-gray-500 dark:text-gray-400 dark:hover:bg-blue-900/20 p-2 h-auto rounded-full group"
                          >
                            <Share className="h-5 w-5 group-hover:bg-blue-500/10 p-1 rounded-full" />
                          </Button>
                        </div>
                        
                        {/* Comments Section */}
                        {showComments === post.id && (
                          <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-800 pt-3">
                            {/* Comment Input */}
                            <div className="flex gap-3">
                              <Image
                                src={profile?.profilePhotoUrl || 'https://placehold.co/32x32/FFB6C1/FFFFFF?text=U'}
                                alt="Your avatar"
                                width={32}
                                height={32}
                                className="rounded-full object-cover aspect-square flex-shrink-0"
                              />
                              <div className="flex-1 flex gap-2">
                                <Input
                                  placeholder="返信をツイート"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                <Button
                                  size="sm"
                                  className="bg-[#F0306A] hover:bg-[#E02860] text-white rounded-full px-4"
                                  onClick={() => handleAddComment(post.originalPost ? post.originalPost.id : post.id)}
                                  disabled={isCommenting || !newComment.trim()}
                                >
                                  {isCommenting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    '返信'
                                  )}
                                </Button>
                              </div>
                            </div>
                            
                            {/* Comments List */}
                            {post.commentsList && post.commentsList.length > 0 && (
                              <div className="space-y-3">
                                {post.commentsList.map((comment) => (
                                  <div key={comment.id} className="flex gap-3">
                                    <div className="w-8 h-8 flex-shrink-0">
                                      <Image
                                        src={comment.authorImage}
                                        alt={comment.author}
                                        width={32}
                                        height={32}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-sm">{comment.author}</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm">@{comment.author.toLowerCase().replace(/\s+/g, '')}</span>
                                        <span className="text-gray-500 dark:text-gray-400">·</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm">{formatTimestamp(comment.timestamp)}</span>
                                        {(comment.authorId === currentUser?.uid || isAdmin) && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteComment(post.originalPost ? post.originalPost.id : post.id, comment.id)}
                                            className="ml-auto text-red-500 hover:text-red-600 p-1 h-auto"
                                            title={isAdmin && comment.authorId !== currentUser?.uid ? "管理者として削除" : "削除"}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{comment.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Desktop & Mobile */}
        <div className={`${
          isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out fixed inset-y-0 right-0 w-80 xl:w-96 flex flex-col overflow-y-scroll overscroll-y-contain pointer-events-auto border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-[60] lg:z-auto p-4 pr-3 space-y-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]`} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            {/* Mobile Close Button */}
            <div className="flex items-center justify-between lg:hidden mb-4">
              <h2 className="text-xl font-bold">検索とコミュニティ</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRightSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="検索"
                className="pl-10 rounded-full bg-gray-100 dark:bg-gray-800 border-none focus-visible:ring-1 focus-visible:ring-[#F0306A]"
              />
            </div>

            {/* Trends */}
            <Card className="p-4">
              <h3 className="text-xl font-bold mb-3">いまどうしてる？</h3>
              <div className="space-y-3">
                {trendsLoading ? (
                  <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="ml-2 text-sm">読み込み中...</p>
                  </div>
                ) : trends.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">まだトレンドがありません</p>
                    <p className="text-xs mt-1">ハッシュタグを使って投稿してみましょう！</p>
                  </div>
                ) : (
                  trends.map((trend, index) => (
                    <div 
                      key={trend.hashtag} 
                      className="flex justify-between items-start hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-lg cursor-pointer transition-colors"
                      onClick={() => handleTrendClick(trend.hashtag)}
                    >
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">トレンド #{index + 1}</p>
                        <p className="font-bold text-[#F0306A] hover:underline">{trend.hashtag}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{trend.count} 投稿</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>


            {/* Communities */}
            <Card className="p-4">
              <h3 className="text-xl font-bold mb-3">コミュニティ</h3>
              <div className="space-y-2">
                {loadingCommunities ? (
                  <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="ml-2 text-sm">読み込み中...</p>
                  </div>
                ) : communities.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">コミュニティがありません</p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedCommunity(null);
                        setIsRightSidebarOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        !selectedCommunity ? 'bg-[#F0306A]/10 text-[#F0306A] font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>全体の投稿</span>
                        </div>
                        <span className="text-sm text-gray-500">すべて</span>
                      </div>
                    </button>
                    {communities.map((community) => (
                      <div key={community.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`community-${community.id}`}
                          checked={selectedCommunities.includes(community.id)}
                          onChange={(e) => handleCommunityCheckboxChange(community.id, e.target.checked)}
                          className="w-4 h-4 rounded text-[#F0306A] focus:ring-[#F0306A] focus:ring-offset-0"
                        />
                        <div className="flex-1 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedCommunity(community.id);
                              setIsRightSidebarOpen(false);
                            }}
                            className={`flex-1 text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                              selectedCommunity === community.id ? 'bg-[#F0306A]/10 text-[#F0306A] font-semibold' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 flex-shrink-0">
                                  <Image
                                    src={community.imageUrl || 'https://placehold.co/24x24/FFB6C1/FFFFFF?text=C'}
                                    alt={community.name}
                                    width={24}
                                    height={24}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm truncate">{community.name}</span>
                                  <div className="flex items-center gap-2">
                                    {community.isJoined && (
                                      <Badge variant="secondary" className="text-xs px-1 py-0">参加中</Badge>
                                    )}
                                    <span className="text-xs text-gray-500">{community.memberCount}人</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                          {(community.createdBy === currentUser?.uid || isAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCommunity(community.id)}
                              className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title={isAdmin && community.createdBy !== currentUser?.uid ? "管理者として削除" : "削除"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {showJoinButton && (
                      <Button 
                        onClick={handleJoinCommunities}
                        className="w-full bg-[#F0306A] hover:bg-[#E02860] text-white mt-2"
                      >
                        選択したコミュニティを更新
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Create Community */}
            <Button 
              variant="outline"
              onClick={() => {
                setShowCreateCommunity(true);
                setIsRightSidebarOpen(false);
              }}
              disabled={!isPremium && !subscriptionLoading}
              className="w-full"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              コミュニティ作成
            </Button>
        </div>
      </div>
    </div>
  );
}