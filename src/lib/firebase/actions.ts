"use client";

import { 
  addDoc, 
  updateDoc, 
  doc, 
  collection, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from './client';

// Community Actions
export async function joinCommunity(communityId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const communityRef = doc(db, 'communities', communityId);
  await updateDoc(communityRef, {
    members: arrayUnion(userId),
    memberCount: increment(1)
  });
}

export async function leaveCommunity(communityId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const communityRef = doc(db, 'communities', communityId);
  await updateDoc(communityRef, {
    members: arrayRemove(userId),
    memberCount: increment(-1)
  });
}

export async function createCommunityPost(
  communityId: string,
  userId: string,
  content: string
) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const postsRef = collection(db, 'communities', communityId, 'posts');
  const newPost = await addDoc(postsRef, {
    authorId: userId,
    content,
    likes: [],
    likeCount: 0,
    comments: [],
    createdAt: serverTimestamp()
  });
  
  return newPost.id;
}

// Message Actions
export async function sendMessage(
  matchId: string,
  senderId: string,
  text: string
) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const messagesRef = collection(db, 'matches', matchId, 'messages');
  const newMessage = await addDoc(messagesRef, {
    senderId,
    text,
    read: false,
    createdAt: serverTimestamp()
  });
  
  // Update match with last message info
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${senderId}`]: 0, // Reset sender's unread count
  });
  
  return newMessage.id;
}

export async function markMessageAsRead(
  matchId: string,
  messageId: string,
  userId: string
) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const messageRef = doc(db, 'matches', matchId, 'messages', messageId);
  await updateDoc(messageRef, {
    read: true
  });
  
  // Reset unread count for this user
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    [`unreadCount.${userId}`]: 0
  });
}

// Match Actions
export async function createMatch(userId1: string, userId2: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const matchesRef = collection(db, 'matches');
  const newMatch = await addDoc(matchesRef, {
    users: [userId1, userId2],
    matchedAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: {
      [userId1]: 0,
      [userId2]: 0
    }
  });
  
  return newMatch.id;
}

// Like Actions
export async function sendLike(fromUserId: string, toUserId: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  const likesRef = collection(db, 'likes');
  await addDoc(likesRef, {
    from: fromUserId,
    to: toUserId,
    createdAt: serverTimestamp(),
    seen: false
  });
  
  // Check if there's a mutual like (they liked us back)
  // This would be done server-side in production
}