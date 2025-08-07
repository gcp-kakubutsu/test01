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
                console.log('Permission denied - likely during logout');
                setProfile(null);
                setLoading(false);
                return;
              }
              
              console.error('Error in profile listener:', err);
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
          console.log('Permission denied - likely during logout');
          setProfile(null);
          setLoading(false);
          return;
        }
        console.error('Error fetching user profile:', err);
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
        console.error('Error fetching communities:', err);
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
        console.error('Error fetching messages:', err);
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
        console.error(`Error fetching user ${userId}:`, error);
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
        console.error('Error fetching matches:', err);
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
    profileViews: 0
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
        let currentStats = { likesReceived: 0, matchesCount: 0, profileViews: 0 };

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
          console.error('Error listening to profile views:', error);
        });

        // Get likes received (one-time fetch for now)
        if (!db) throw new Error('Firestore is not initialized');
        const likesRef = collection(db, 'likes');
        const likesQuery = query(likesRef, where('to', '==', targetUserId));
        const likesSnapshot = await getDocs(likesQuery);
        currentStats.likesReceived = likesSnapshot.size;

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
        console.error('Error fetching user stats:', err);
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