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
import { Users, MessageSquare, Heart, Plus, Search, TrendingUp, Loader2, Trash2, PlusCircle, Upload, Camera, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { db, functions, storage } from '@/lib/firebase/client';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeCommunityCollections } from '@/lib/firebase/init-community';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumOnlyCard from '@/components/PremiumOnlyCard';
import { getPremiumMessage } from '@/config/premium-messages';
import { useUserProfile } from '@/lib/firebase/hooks';

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
  communityId: string;
  isLiked?: boolean;
  likedBy?: string[];
  commentsList?: Comment[];
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
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
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
  
  // Check if current user is admin
  const isAdmin = currentUser?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(currentUser.email);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check premium status
  useEffect(() => {
    if (!subscriptionLoading && isAuthenticated && !isPremium) {
      // User is not premium, don't initialize or fetch community data
      console.log('Community is premium-only feature');
    }
  }, [subscriptionLoading, isAuthenticated, isPremium]);

  // Fetch communities from Firebase (Premium only)
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !isPremium) {
      setLoadingCommunities(false);
      setLoadingPosts(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const fetchCommunities = async () => {
      try {
        setLoadingCommunities(true);
        
        // Check if component is still mounted and user is authenticated
        if (!isMounted || !currentUser || !db) {
          console.log('Component unmounted or user not authenticated');
          setLoadingCommunities(false);
          return;
        }
        
        const communitiesRef = collection(db, 'communities');
        const communitiesQuery = query(communitiesRef, orderBy('memberCount', 'desc'));
        
        unsubscribe = onSnapshot(communitiesQuery, 
          (snapshot) => {
            // Check if component is still mounted
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
            setLoadingCommunities(false);
          },
          (error) => {
            // Check if component is still mounted
            if (!isMounted) {
              console.log('Component unmounted, ignoring error');
              return;
            }
            
            console.error('Error fetching communities:', error);
            setLoadingCommunities(false);
            
            // Handle permission errors specifically
            const firebaseError = error as any;
            if (firebaseError.code === 'permission-denied' || 
                firebaseError.message?.includes('Missing or insufficient permissions')) {
              // Check if user is still authenticated
              if (!currentUser) {
                // User has logged out, this is expected - don't show error
                console.log('Permission denied after logout - expected');
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
      } catch (error) {
        if (!isMounted) return;
        
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
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, currentUser?.uid, toast, isPremium]);

  // Fetch posts (Premium only) - either for selected community or global
  useEffect(() => {
    if (!currentUser || !isPremium) return;

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const fetchPosts = async () => {
      try {
        setLoadingPosts(true);
        
        // Check if component is still mounted and user is authenticated
        if (!isMounted || !currentUser || !db) {
          console.log('Component unmounted or user not authenticated (posts)');
          setLoadingPosts(false);
          return;
        }
        
        const postsRef = collection(db, 'posts');
        
        // Try with compound query first, fall back to simple query if index not available
        let postsQuery;
        try {
          if (selectedCommunity) {
            // Fetch posts for specific community
            postsQuery = query(
              postsRef,
              where('communityId', '==', selectedCommunity),
              orderBy('timestamp', 'desc'),
              limit(50)
            );
          } else {
            // Fetch only global posts (not community-specific posts)
            postsQuery = query(
              postsRef,
              where('communityId', '==', 'global'),
              orderBy('timestamp', 'desc'),
              limit(50)
            );
          }
        } catch (error) {
          console.log('Compound index not available, using simple query');
          // Fall back to simple query without ordering
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
            // Check if component is still mounted
            if (!isMounted || !currentUser) {
              console.log('Component unmounted during posts snapshot');
              return;
            }
            
            const postsData = await Promise.all(
              snapshot.docs.map(async (doc) => {
                const data = doc.data();
                
                // Fetch comments for each post
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
                  commentsList: comments
                } as Post;
              })
            );
            setPosts(postsData);
            setLoadingPosts(false);
          },
          (error: any) => {
            // Check if component is still mounted
            if (!isMounted) {
              console.log('Component unmounted, ignoring posts error');
              return;
            }
            
            console.error('Error fetching posts:', error);
            setLoadingPosts(false);
            
            // Handle different types of errors
            if (error.code === 'failed-precondition' || 
                error.message?.includes('requires an index')) {
              // Index not ready yet
              console.log('Index not ready, retrying with simple query');
              
              // Try simple query without ordering
              const simpleQuery = selectedCommunity 
                ? query(
                    collection(db, 'posts'),
                    where('communityId', '==', selectedCommunity),
                    limit(50)
                  )
                : query(
                    collection(db, 'posts'),
                    where('communityId', '==', 'global'),
                    limit(50)
                  );
              
              // Re-subscribe with simple query
              const simpleUnsubscribe = onSnapshot(simpleQuery,
                async (snapshot) => {
                  if (!isMounted || !currentUser) return;
                  
                  const postsData = await Promise.all(
                    snapshot.docs.map(async (doc) => {
                      const data = doc.data();
                      
                      // Fetch comments for each post
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
                        commentsList: comments
                      } as Post;
                    })
                  );
                  
                  // Sort posts by timestamp manually
                  postsData.sort((a, b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return bTime - aTime;
                  });
                  
                  setPosts(postsData);
                  setLoadingPosts(false);
                },
                (err) => {
                  if (!isMounted) return;
                  console.error('Simple query also failed:', err);
                  setPosts([]);
                  setLoadingPosts(false);
                }
              );
              
              // Update unsubscribe reference
              unsubscribe = simpleUnsubscribe;
              return;
            } else if (error.code === 'permission-denied' || 
                error.message?.includes('Missing or insufficient permissions')) {
              // Check if user is still authenticated
              if (!currentUser) {
                console.log('Permission denied after logout (posts) - expected');
                return;
              }
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
      } catch (error) {
        if (!isMounted) return;
        
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
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedCommunity, currentUser?.uid, toast, isPremium]);

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

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!currentUser) return;
    
    try {
      if (!db) throw new Error('Firestore is not initialized');
      
      // Get comment to check author
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
      
      // Check if user is author or admin
      if (commentData.authorId === currentUser.uid) {
        // Author can delete directly
        await deleteDoc(commentRef);
        
        // Update comment count
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
          comments: increment(-1)
        });
        
        // Update local state
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
      } else if (isAdmin) {
        // Admin uses Cloud Function
        if (!functions) {
          toast({
            title: "エラー",
            description: "Firebase Functionsが初期化されていません。",
            variant: "destructive",
          });
          return;
        }
        
        const deleteCommentAsAdmin = httpsCallable(functions, 'deleteCommentAsAdmin');
        const result = await deleteCommentAsAdmin({ postId, commentId });
        const data = result.data as any;
        
        if (data.success) {
          // Update local state
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
            title: "管理者として削除しました",
            description: data.message || "コメントが正常に削除されました。",
          });
        } else {
          throw new Error(data.message || "削除に失敗しました");
        }
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
        description: error.message || "コメントの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !newComment.trim()) return;
    
    if (!isPremium) {
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
        authorImage: profile?.profilePhotoUrl || currentUser.photoURL || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
        content: newComment,
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(commentsRef, newCommentData);
      
      // Update comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: increment(1)
      });
      
      // Update local state with new comment
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
      
      if (!post) {
        toast({
          title: "エラー",
          description: "投稿が見つかりません。",
          variant: "destructive",
        });
        return;
      }
      
      // Check if user is the author
      if (post.authorId === currentUser.uid) {
        // Author can delete their own post directly
        const postRef = doc(db, 'posts', postId);
        await deleteDoc(postRef);
        
        toast({
          title: "投稿を削除しました",
          description: "投稿が正常に削除されました。",
        });
      } else if (isAdmin) {
        // Admin uses Cloud Function to delete post
        if (!functions) {
          toast({
            title: "エラー",
            description: "Firebase Functionsが初期化されていません。",
            variant: "destructive",
          });
          return;
        }
        
        const deletePostAsAdmin = httpsCallable(functions, 'deletePostAsAdmin');
        const result = await deletePostAsAdmin({ postId });
        const data = result.data as any;
        
        if (data.success) {
          toast({
            title: "管理者として削除しました",
            description: data.message || "投稿が正常に削除されました。",
          });
        } else {
          throw new Error(data.message || "削除に失敗しました");
        }
      } else {
        toast({
          title: "エラー",
          description: "この投稿を削除する権限がありません。",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting post:', error);
      
      // Handle specific Cloud Function errors
      if (error.code === 'functions/unauthenticated') {
        toast({
          title: "認証エラー",
          description: "再度ログインしてください。",
          variant: "destructive",
        });
      } else if (error.code === 'functions/permission-denied') {
        toast({
          title: "権限エラー",
          description: "管理者権限が必要です。",
          variant: "destructive",
        });
      } else {
        toast({
          title: "エラー",
          description: error.message || "投稿の削除に失敗しました。",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    if (!currentUser) return;
    
    try {
      const community = communities.find(c => c.id === communityId);
      if (!community) {
        toast({
          title: "エラー",
          description: "コミュニティが見つかりません。",
          variant: "destructive",
        });
        return;
      }
      
      // Check if user is creator or admin
      if (community.createdBy === currentUser.uid) {
        // Creator can delete directly
        if (!db) throw new Error('Firestore is not initialized');
        const communityRef = doc(db, 'communities', communityId);
        await deleteDoc(communityRef);
        
        toast({
          title: "コミュニティを削除しました",
          description: "コミュニティが正常に削除されました。",
        });
        
        // Reset selected community if it was deleted
        if (selectedCommunity === communityId) {
          setSelectedCommunity(null);
        }
      } else if (isAdmin) {
        // Admin uses Cloud Function
        if (!functions) {
          toast({
            title: "エラー",
            description: "Firebase Functionsが初期化されていません。",
            variant: "destructive",
          });
          return;
        }
        
        const deleteCommunity = httpsCallable(functions, 'deleteCommunity');
        const result = await deleteCommunity({ communityId });
        const data = result.data as any;
        
        if (data.success) {
          toast({
            title: "管理者としてコミュニティを削除しました",
            description: data.message || "コミュニティが正常に削除されました。",
          });
          
          if (selectedCommunity === communityId) {
            setSelectedCommunity(null);
          }
        } else {
          throw new Error(data.message || "削除に失敗しました");
        }
      } else {
        toast({
          title: "エラー",
          description: "このコミュニティを削除する権限がありません。",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting community:', error);
      toast({
        title: "エラー",
        description: error.message || "コミュニティの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "エラー",
          description: "画像サイズは5MB以下にしてください。",
          variant: "destructive",
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "エラー",
          description: "画像ファイルを選択してください。",
          variant: "destructive",
        });
        return;
      }
      
      setNewCommunityImageFile(file);
      
      // Create preview without cropping
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadCommunityImage = async (file: File): Promise<string> => {
    if (!storage) throw new Error('Storage is not initialized');
    if (!currentUser) throw new Error('User not authenticated');
    
    const timestamp = Date.now();
    const fileName = `communities/${currentUser.uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  };

  const handleCreateCommunity = async () => {
    if (!currentUser || !newCommunityName.trim() || !newCommunityDescription.trim()) return;
    
    if (!isPremium) {
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
      
      // Upload image if file is selected
      if (newCommunityImageFile) {
        setIsUploadingImage(true);
        try {
          imageUrl = await uploadCommunityImage(newCommunityImageFile);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast({
            title: "画像アップロードエラー",
            description: "画像のアップロードに失敗しました。URLを直接入力するか、別の画像をお試しください。",
            variant: "destructive",
          });
          // Continue without image
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      // Use default image if no image provided
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
        description: `${newCommunityName}が正常に作成されました。`,
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

  const handleCreatePost = async () => {
    if (!currentUser || !newPostContent.trim()) return;
    
    // Check premium status before posting
    if (!isPremium) {
      toast({
        title: "プレミアム機能",
        description: "投稿機能はプレミアム会員限定です。",
        variant: "destructive",
      });
      return;
    }
    
    // Check if posting to a specific community
    if (postDestination !== 'global') {
      const community = communities.find(c => c.id === postDestination);
      if (community && !community.isJoined && !isAdmin) {
        toast({
          title: "参加が必要",
          description: "このコミュニティに投稿するには参加が必要です。",
          variant: "destructive",
        });
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
        authorImage: profile?.profilePhotoUrl || currentUser.photoURL || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U',
        content: newPostContent,
        communityId: postDestination,
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        likedBy: []
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

  if (isLoading || !isAuthenticated || subscriptionLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  // Show premium-only message if not premium
  if (!isPremium) {
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
    <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">コミュニティ</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline"
            onClick={() => setShowCreateCommunity(true)}
            disabled={!isPremium}
            className="flex-1 sm:flex-initial text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2 h-9 sm:h-10"
          >
            <PlusCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">コミュニティ作成</span>
            <span className="sm:hidden">作成</span>
          </Button>
          <Button 
            className="bg-[#F0306A] hover:bg-[#E02860] flex-1 sm:flex-initial text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2 h-9 sm:h-10"
            onClick={() => {
              if (!isPremium) {
                toast({
                  title: "プレミアム機能",
                  description: "投稾機能はプレミアム会員限定です。",
                  variant: "destructive",
                });
                return;
              }
              
              // Check if user can post to selected community
              if (selectedCommunity && selectedCommunity !== 'global') {
                const community = communities.find(c => c.id === selectedCommunity);
                if (community && !community.isJoined && !isAdmin) {
                  toast({
                    title: "参加が必要",
                    description: "このコミュニティに投稿するには参加が必要です。",
                    variant: "destructive",
                  });
                  return;
                }
              }
              
              setShowNewPost(true);
              // スクロールして投稿フォームを表示
              setTimeout(() => {
                postFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            disabled={!isPremium}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            投稿する
          </Button>
        </div>
      </div>

      {/* Create Community Modal */}
      {showCreateCommunity && (
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
            <div className="space-y-2">
              <label className="text-sm font-medium">コミュニティ画像</label>
              
              <div className="w-full">
                <div className="relative w-full">
                  {imagePreview || newCommunityImage ? (
                    <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={imagePreview || newCommunityImage}
                        alt="Community preview"
                        className="w-full h-auto"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          setImagePreview('');
                          setNewCommunityImage('');
                          setNewCommunityImageFile(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 w-full rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Camera className="h-12 w-12 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">画像を追加</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                    </label>
                  )}
                </div>
              </div>
              
              {!imagePreview && !newCommunityImage && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = prompt('画像URLを入力してください:');
                      if (url) {
                        setNewCommunityImage(url);
                        setNewCommunityImageFile(null);
                        setImagePreview('');
                      }
                    }}
                  >
                    URLから画像を追加
                  </Button>
                </div>
              )}
              
              {isUploadingImage && (
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  画像をアップロード中...
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateCommunity(false);
                  // Reset form
                  setNewCommunityName('');
                  setNewCommunityDescription('');
                  setNewCommunityCategory('');
                  setNewCommunityImage('');
                  setNewCommunityImageFile(null);
                  setImagePreview('');
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
      )}

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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4">
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
              <div className="relative w-full bg-gray-100 rounded-t-lg overflow-hidden">
                <img
                  src={community.imageUrl}
                  alt={community.name}
                  className="w-full h-auto"
                />
                <Badge className="absolute top-2 right-2 bg-white/90 text-black z-10">
                  {community.category}
                </Badge>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{community.name}</CardTitle>
                    <p className="text-sm text-gray-600">{community.description}</p>
                  </div>
                  {(community.createdBy === currentUser?.uid || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`本当に「${community.name}」を削除しますか？`)) {
                          handleDeleteCommunity(community.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-600"
                      title={isAdmin && community.createdBy !== currentUser?.uid ? "管理者として削除" : "削除"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

      {/* Timeline Tabs */}
      <div className="space-y-4">
        <div className="border-b overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-4 min-w-max pb-1">
            <Button
              variant="ghost"
              className={`pb-2 border-b-2 rounded-none whitespace-nowrap text-sm sm:text-base px-2 sm:px-4 ${
                !selectedCommunity ? 'border-[#F0306A] text-[#F0306A]' : 'border-transparent'
              }`}
              onClick={() => setSelectedCommunity(null)}
            >
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              全体の投稿
            </Button>
            {communities.map(community => (
              community.isJoined && (
                <Button
                  key={community.id}
                  variant="ghost"
                  className={`pb-2 border-b-2 rounded-none whitespace-nowrap text-sm sm:text-base px-2 sm:px-4 ${
                    selectedCommunity === community.id ? 'border-[#F0306A] text-[#F0306A]' : 'border-transparent'
                  }`}
                  onClick={() => setSelectedCommunity(community.id)}
                >
                  {community.name}
                </Button>
              )
            ))}
          </div>
        </div>

          {/* New Post Form */}
          {showNewPost && (
            <Card className="p-4" ref={postFormRef}>
              <div className="space-y-3">
                {/* Post destination selector */}
                <div>
                  <label className="text-sm font-medium mb-1 block">投稿先</label>
                  <Select
                    value={postDestination}
                    onValueChange={setPostDestination}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="投稿先を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">全体の投稿</SelectItem>
                      {communities
                        .filter(c => c.isJoined || isAdmin)
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
                  placeholder={
                    postDestination === 'global'
                      ? "何か投稿してみましょう..."
                      : `${communities.find(c => c.id === postDestination)?.name || 'コミュニティ'}に投稿...`
                  }
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="mb-3"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowNewPost(false);
                    setNewPostContent('');
                    setPostDestination('global');
                  }}>
                    キャンセル
                  </Button>
                  <Button 
                    className="bg-[#F0306A] hover:bg-[#E02860]"
                    onClick={handleCreatePost}
                    disabled={isPosting || !newPostContent.trim() || !isPremium}
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
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{post.author}</span>
                          <span className="text-sm text-gray-500">{formatTimestamp(post.timestamp)}</span>
                        </div>
                        {(post.authorId === currentUser?.uid || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePost(post.id)}
                            className="text-red-500 hover:text-red-600"
                            title={isAdmin && post.authorId !== currentUser?.uid ? "管理者として削除" : "削除"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>{post.comments}</span>
                        </Button>
                      </div>
                      
                      {/* Comments Section */}
                      {showComments === post.id && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          {/* Comment Input */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="コメントを入力..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              className="bg-[#F0306A] hover:bg-[#E02860]"
                              onClick={() => handleAddComment(post.id)}
                              disabled={isCommenting || !newComment.trim()}
                            >
                              {isCommenting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                '投稿'
                              )}
                            </Button>
                          </div>
                          
                          {/* Comments List */}
                          {post.commentsList && post.commentsList.length > 0 && (
                            <div className="space-y-2">
                              {post.commentsList.map((comment) => (
                                <div key={comment.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                                  <Image
                                    src={comment.authorImage}
                                    alt={comment.author}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold">{comment.author}</span>
                                      <span className="text-xs text-gray-500">{formatTimestamp(comment.timestamp)}</span>
                                      {(comment.authorId === currentUser?.uid || isAdmin) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteComment(post.id, comment.id)}
                                          className="ml-auto text-red-500 hover:text-red-600 p-1 h-auto"
                                          title={isAdmin && comment.authorId !== currentUser?.uid ? "管理者として削除" : "削除"}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  );
}