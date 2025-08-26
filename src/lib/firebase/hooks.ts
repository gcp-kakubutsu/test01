"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  birthDate: string;
  gender: string;
  bio?: string;
  profilePhotoUrl?: string;
  location?: string;
  occupation?: string;
  interests?: string[];
  accountStatus?: string;
  createdAt?: any;
  updatedAt?: any;
  age?: number;
  additionalPhotos?: string[];
}

export function useUserProfile(userId?: string) {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uid = userId || currentUser?.uid;

  useEffect(() => {
    if (!uid || !db) {
      setLoading(false);
      setProfile(null);
      setError(null);
      return;
    }

    // Check if user is still authenticated before setting up listener
    if (!currentUser) {
      setLoading(false);
      setProfile(null);
      setError(null);
      return;
    }

    if (!db) throw new Error('Firestore is not initialized');
    const userRef = doc(db, 'users', uid);
    
    let unsubscribeFunction: (() => void) | null = null;
    let isActive = true; // Track if this effect is still active
    
    // First try to get the document once
    getDoc(userRef)
      .then((snapshot) => {
        if (!isActive || !currentUser) return; // Exit if logged out
        
        if (snapshot.exists()) {
          // Document exists, set up real-time listener
          unsubscribeFunction = onSnapshot(
            userRef,
            (snapshot) => {
              if (!isActive || !currentUser) return; // Exit if logged out
              
              if (snapshot.exists()) {
                setProfile({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
              } else {
                setProfile(null);
              }
              setLoading(false);
            },
            (err) => {
              if (!isActive || !currentUser) return; // Exit if logged out
              
              // Handle permission errors silently during logout
              const firebaseError = err as any;
              if (firebaseError.code === 'permission-denied' || 
                  firebaseError.message?.includes('Missing or insufficient permissions')) {
                // Silently handle permission denied during logout
                setProfile(null);
                setLoading(false);
                return;
              }
              
              // Silently handle profile listener errors
              setError('プロフィールの取得に失敗しました');
              setLoading(false);
            }
          );
        } else {
          // Document doesn't exist, return empty profile
          setProfile(null);
          setLoading(false);
          setError(null); // No error, just no profile yet
        }
      })
      .catch((err) => {
        if (!isActive || !currentUser) return; // Exit if logged out
        
        // Handle permission errors
        const firebaseError = err as any;
        if (firebaseError.code === 'permission-denied' || 
            firebaseError.message?.includes('Missing or insufficient permissions')) {
          // Silently handle permission denied during logout
          setProfile(null);
          setLoading(false);
          return;
        }
        // Silently handle profile fetch errors
        setError('プロフィールの取得に失敗しました');
        setLoading(false);
      });
    
    // Return cleanup function
    return () => {
      isActive = false;
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [uid, currentUser]);

  return { profile, loading, error };
}

// Match interface - moved here from later in the file
export interface Match {
  id: string;
  users: string[];
  matchedAt: any;
  lastMessage?: string;
  lastMessageAt?: any;
  status?: string;
  initiator?: string;
  unreadCount?: { [userId: string]: number };
}

export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  memberCount: number;
  members: string[];
  createdBy: string;
  createdAt: any;
}

export function useCommunities() {
  const { currentUser } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // Check if user is authenticated
    if (!currentUser) {
      setLoading(false);
      setCommunities([]);
      return;
    }

    if (!db) throw new Error('Firestore is not initialized');
    const communitiesRef = collection(db, 'communities');
    const q = query(communitiesRef, orderBy('memberCount', 'desc'), limit(20));

    let isActive = true;
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive || !currentUser) return;
        
        const communitiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Community));
        setCommunities(communitiesData);
        setLoading(false);
      },
      (err) => {
        if (!isActive || !currentUser) return;
        
        // Handle permission errors gracefully when user is logged out
        const firebaseError = err as any;
        if (firebaseError.code === 'permission-denied') {
          // User logged out, this is expected
          setCommunities([]);
          setLoading(false);
          return;
        }
        // Silently handle community fetch errors
        setError('コミュニティの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [currentUser]);

  return { communities, loading, error };
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  createdAt: any;
  read: boolean;
}

export function useMessages(matchId: string) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !db) {
      setLoading(false);
      return;
    }

    // Check if user is authenticated
    if (!currentUser) {
      setLoading(false);
      setMessages([]);
      return;
    }

    if (!db) throw new Error('Firestore is not initialized');
    const messagesRef = collection(db, 'matches', matchId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          matchId,
          ...doc.data()
        } as Message));
        setMessages(messagesData);
        setLoading(false);
      },
      (err) => {
        // Handle permission errors gracefully when user is logged out
        const firebaseError = err as any;
        if (firebaseError.code === 'permission-denied' && !currentUser) {
          // User logged out, this is expected
          setMessages([]);
          setLoading(false);
          return;
        }
        // Silently handle message fetch errors
        setError('メッセージの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matchId, currentUser]);

  return { messages, loading, error };
}

// Fetch multiple user profiles at once
export async function fetchUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  if (!db || userIds.length === 0) return new Map();
  
  const profiles = new Map<string, UserProfile>();
  
  // Firestore has a limit of 10 for 'in' queries
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }
  
  for (const chunk of chunks) {
    // Use document IDs directly instead of uid field
    if (!db) throw new Error('Firestore is not initialized');
    
    // Fetch each user document by ID
    for (const userId of chunk) {
      try {
        if (!db) throw new Error('Firestore is not initialized');
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          profiles.set(userId, { uid: userId, ...userDoc.data() } as UserProfile);
        }
      } catch (error) {
        // Silently handle user fetch errors
      }
    }
  }
  
  return profiles;
}

// Hook to get matches for current user
export function useMatches() {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      setMatches([]);
      return;
    }

    // Query matches where current user is in the users array (no orderBy to avoid index requirement)
    if (!db) throw new Error('Firestore is not initialized');
    const matchesRef = collection(db, 'matches');
    const q = query(
      matchesRef,
      where('users', 'array-contains', currentUser.uid)
    );

    let isActive = true; // Track if this effect is still active
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive || !currentUser) return; // Exit if logged out
        
        const matchesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Match));
        // Sort by matchedAt client-side
        matchesData.sort((a, b) => {
          const aTime = a.matchedAt?.toDate?.()?.getTime() || 0;
          const bTime = b.matchedAt?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
        setMatches(matchesData);
        setLoading(false);
      },
      (err) => {
        if (!isActive || !currentUser) return; // Exit if logged out
        
        // Handle permission errors gracefully when user is logged out
        const firebaseError = err as any;
        if (firebaseError.code === 'permission-denied') {
          // User logged out or no permission, this might be expected
          setMatches([]);
          setLoading(false);
          return;
        }
        // Silently handle match fetch errors
        setError('マッチの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [currentUser]);

  return { matches, loading, error };
}

// Hook to get user statistics (likes received, matches count, profile views)
export function useUserStats(userId?: string) {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    likesReceived: 0,
    matchesCount: 0,
    profileViews: 0,
    requestsReceived: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || currentUser?.uid;

  useEffect(() => {
    if (!targetUserId || !db) {
      setLoading(false);
      return;
    }

    const setupStatsListeners = async () => {
      try {
        setLoading(true);
        let currentStats = { likesReceived: 0, matchesCount: 0, profileViews: 0, requestsReceived: 0 };

        // Set up real-time listener for profile views
        if (!db) throw new Error('Firestore is not initialized');
        const viewsRef = collection(db, 'profileViews');
        const viewsQuery = query(viewsRef, where('viewedUserId', '==', targetUserId));
        const unsubscribeViews = onSnapshot(viewsQuery, (snapshot) => {
          currentStats.profileViews = snapshot.size;
          setStats({ ...currentStats });
        }, (error) => {
          // Handle permission errors gracefully
          const firebaseError = error as any;
          if (firebaseError.code === 'permission-denied') {
            // User might have logged out, ignore this error
            return;
          }
          // Silently handle profile view errors
        });

        // Get likes received (requests) - these are likes sent TO the user
        if (!db) throw new Error('Firestore is not initialized');
        const likesRef = collection(db, 'likes');
        const receivedLikesQuery = query(likesRef, where('to', '==', targetUserId));
        const receivedLikesSnapshot = await getDocs(receivedLikesQuery);
        currentStats.requestsReceived = receivedLikesSnapshot.size; // This is the request count
        
        // Get likes sent by the user
        const sentLikesQuery = query(likesRef, where('from', '==', targetUserId));
        const sentLikesSnapshot = await getDocs(sentLikesQuery);
        currentStats.likesReceived = sentLikesSnapshot.size; // Keep this for いいね count

        // Get matches count (one-time fetch for now)
        if (!db) throw new Error('Firestore is not initialized');
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(matchesRef, where('users', 'array-contains', targetUserId));
        const matchesSnapshot = await getDocs(matchesQuery);
        currentStats.matchesCount = matchesSnapshot.size;

        setStats(currentStats);
        setLoading(false);

        // Return cleanup function
        return () => {
          unsubscribeViews();
        };
      } catch (err) {
        // Silently handle stats fetch errors
        setError('統計情報の取得に失敗しました');
        setLoading(false);
      }
    };

    let cleanup: (() => void) | undefined;
    setupStatsListeners().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [targetUserId]);

  return { stats, loading, error };
}

// Trend interface for hashtag trends
export interface Trend {
  hashtag: string;
  count: number;
}

// Hook to get trending hashtags from posts
export function useTrends(limit: number = 3) {
  const { currentUser } = useAuth();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      setTrends([]);
      return;
    }

    let isActive = true;

    const fetchTrends = async () => {
      try {
        if (!db) throw new Error('Firestore is not initialized');
        const postsRef = collection(db, 'posts');
        const postsSnapshot = await getDocs(postsRef);
        
        const hashtagCount = new Map<string, number>();
        
        postsSnapshot.docs.forEach(doc => {
          const post = doc.data();
          if (post.content) {
            // Extract hashtags from post content
            const hashtags = post.content.match(/#[\w\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FAF]+/g) || [];
            hashtags.forEach((hashtag: string) => {
              const normalizedHashtag = hashtag.toLowerCase();
              hashtagCount.set(normalizedHashtag, (hashtagCount.get(normalizedHashtag) || 0) + 1);
            });
          }
        });
        
        // Convert to array and sort by count
        const trendsArray = Array.from(hashtagCount.entries())
          .map(([hashtag, count]) => ({ hashtag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        
        if (isActive) {
          setTrends(trendsArray);
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          const firebaseError = err as any;
          if (firebaseError.code === 'permission-denied') {
            setTrends([]);
            setLoading(false);
            return;
          }
          setError('トレンドの取得に失敗しました');
          setLoading(false);
        }
      }
    };

    fetchTrends();
    
    // Refresh trends every 5 minutes
    const interval = setInterval(fetchTrends, 5 * 60 * 1000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [currentUser, limit]);

  return { trends, loading, error };
}

// Hook to get recommended users (users not followed by current user)
export function useRecommendedUsers(limit: number = 3) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      setUsers([]);
      return;
    }

    let isActive = true;

    const fetchRecommendedUsers = async () => {
      try {
        if (!db) throw new Error('Firestore is not initialized');
        
        // Get all users except current user
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        // Get users that current user is already following/matched with
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(matchesRef, where('users', 'array-contains', currentUser.uid));
        const matchesSnapshot = await getDocs(matchesQuery);
        
        const followedUserIds = new Set<string>();
        matchesSnapshot.docs.forEach(doc => {
          const match = doc.data();
          match.users.forEach((userId: string) => {
            if (userId !== currentUser.uid) {
              followedUserIds.add(userId);
            }
          });
        });
        
        // Filter out current user and already followed users
        const recommendedUsers = usersSnapshot.docs
          .filter(doc => {
            const userId = doc.id;
            return userId !== currentUser.uid && !followedUserIds.has(userId);
          })
          .map(doc => ({
            uid: doc.id,
            ...doc.data()
          } as UserProfile))
          .filter(user => user.username && user.profilePhotoUrl) // Only users with complete profiles
          .sort(() => Math.random() - 0.5) // Randomize
          .slice(0, limit);
        
        if (isActive) {
          setUsers(recommendedUsers);
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          const firebaseError = err as any;
          if (firebaseError.code === 'permission-denied') {
            setUsers([]);
            setLoading(false);
            return;
          }
          setError('おすすめユーザーの取得に失敗しました');
          setLoading(false);
        }
      }
    };

    fetchRecommendedUsers();
    
    // Refresh recommendations every 10 minutes
    const interval = setInterval(fetchRecommendedUsers, 10 * 60 * 1000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [currentUser, limit]);

  return { users, loading, error };
}

// Community stats interface
export interface CommunityStats {
  totalUsers: number;
  totalPosts: number;
  totalCommunities: number;
  activeUsersToday: number;
}

// Hook to get community-wide statistics
export function useCommunityStats() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<CommunityStats>({
    totalUsers: 0,
    totalPosts: 0,
    totalCommunities: 0,
    activeUsersToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchStats = async () => {
      try {
        if (!db) throw new Error('Firestore is not initialized');
        
        const [usersSnapshot, postsSnapshot, communitiesSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'posts')),
          getDocs(collection(db, 'communities'))
        ]);
        
        // Get posts from today for active users calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const postsToday = postsSnapshot.docs.filter(doc => {
          const post = doc.data();
          if (post.timestamp && post.timestamp.toDate) {
            const postDate = post.timestamp.toDate();
            return postDate >= today;
          }
          return false;
        });
        
        // Count unique active users today
        const activeUserIds = new Set(
          postsToday.map(doc => doc.data().authorId).filter(Boolean)
        );
        
        if (isActive) {
          setStats({
            totalUsers: usersSnapshot.size,
            totalPosts: postsSnapshot.size,
            totalCommunities: communitiesSnapshot.size,
            activeUsersToday: activeUserIds.size
          });
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          const firebaseError = err as any;
          if (firebaseError.code === 'permission-denied') {
            setStats({
              totalUsers: 0,
              totalPosts: 0,
              totalCommunities: 0,
              activeUsersToday: 0
            });
            setLoading(false);
            return;
          }
          setError('統計情報の取得に失敗しました');
          setLoading(false);
        }
      }
    };

    fetchStats();
    
    // Refresh stats every hour
    const interval = setInterval(fetchStats, 60 * 60 * 1000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  return { stats, loading, error };
}