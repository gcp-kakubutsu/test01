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
      return;
    }

    const userRef = doc(db, 'users', uid);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
        } else {
          setError('ユーザーが見つかりません');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching user profile:', err);
        setError('プロフィールの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

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
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const communitiesRef = collection(db, 'communities');
    const q = query(communitiesRef, orderBy('memberCount', 'desc'), limit(20));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const communitiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Community));
        setCommunities(communitiesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching communities:', err);
        setError('コミュニティの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !db) {
      setLoading(false);
      return;
    }

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
        console.error('Error fetching messages:', err);
        setError('メッセージの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matchId]);

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
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', 'in', chunk));
    const snapshot = await getDocs(q);
    
    snapshot.docs.forEach(doc => {
      profiles.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
    });
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
      return;
    }

    // Query matches where current user is in the users array (no orderBy to avoid index requirement)
    const matchesRef = collection(db, 'matches');
    const q = query(
      matchesRef,
      where('users', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
        console.error('Error fetching matches:', err);
        setError('マッチの取得に失敗しました');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  return { matches, loading, error };
}

// Hook to get user statistics (likes received, matches count, profile views)
export function useUserStats() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    likesReceived: 0,
    matchesCount: 0,
    profileViews: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);

        // Get likes received
        const likesRef = collection(db, 'likes');
        const likesQuery = query(likesRef, where('to', '==', currentUser.uid));
        const likesSnapshot = await getDocs(likesQuery);
        const likesReceived = likesSnapshot.size;

        // Get matches count
        const matchesRef = collection(db, 'matches');
        const matchesQuery = query(matchesRef, where('users', 'array-contains', currentUser.uid));
        const matchesSnapshot = await getDocs(matchesQuery);
        const matchesCount = matchesSnapshot.size;

        // Get profile views (if implemented)
        // For now, we'll use a placeholder or check if there's a profileViews collection
        let profileViews = 0;
        try {
          const viewsRef = collection(db, 'profileViews');
          const viewsQuery = query(viewsRef, where('viewedUserId', '==', currentUser.uid));
          const viewsSnapshot = await getDocs(viewsQuery);
          profileViews = viewsSnapshot.size;
        } catch (viewsError) {
          // Profile views collection might not exist yet
          console.log('Profile views collection not found, defaulting to 0');
        }

        setStats({
          likesReceived,
          matchesCount,
          profileViews
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError('統計情報の取得に失敗しました');
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser]);

  return { stats, loading, error };
}