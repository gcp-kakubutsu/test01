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

export interface Match {
  id: string;
  users: string[];
  matchedAt: any;
  lastMessage?: string;
  lastMessageAt?: any;
  unreadCount?: { [userId: string]: number };
}

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

    const matchesRef = collection(db, 'matches');
    const q = query(
      matchesRef,
      where('users', 'array-contains', currentUser.uid),
      orderBy('matchedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const matchesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Match));
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