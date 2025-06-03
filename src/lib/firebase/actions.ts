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
  
  try {
    // First, get the match to find the receiver
    const matchRef = doc(db, 'matches', matchId);
    const { getDoc } = await import('firebase/firestore');
    const matchDoc = await getDoc(matchRef);
    
    if (!matchDoc.exists()) {
      throw new Error('Match not found');
    }
    
    const matchData = matchDoc.data();
    const receiverId = matchData.users.find((uid: string) => uid !== senderId);
    
    if (!receiverId) {
      throw new Error('Receiver not found in match');
    }
    
    const messagesRef = collection(db, 'matches', matchId, 'messages');
    const newMessage = await addDoc(messagesRef, {
      senderId,
      text,
      read: false,
      createdAt: serverTimestamp()
    });
    
    // Update match with last message info and increment receiver's unread count
    await updateDoc(matchRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      [`unreadCount.${senderId}`]: 0, // Reset sender's unread count
      [`unreadCount.${receiverId}`]: increment(1), // Increment receiver's unread count
    });
    
    return newMessage.id;
  } catch (error: any) {
    console.error('Error sending message:', error);
    
    // ネットワークエラーの場合は適切なエラーメッセージを投げる
    if (error.code === 'unavailable' || error.message.includes('503')) {
      throw new Error('一時的にサービスが利用できません。しばらくしてから再度お試しください。');
    }
    
    throw error;
  }
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
  
  const { getDocs, query, where } = await import('firebase/firestore');
  const matchesRef = collection(db, 'matches');
  
  // Check if match already exists
  const existingMatchQuery = query(
    matchesRef,
    where('users', 'array-contains', userId1)
  );
  const existingMatchSnapshot = await getDocs(existingMatchQuery);
  
  // Check if any of these matches include both users
  for (const doc of existingMatchSnapshot.docs) {
    const matchData = doc.data();
    if (matchData.users.includes(userId2)) {
      console.log('Match already exists:', doc.id);
      return doc.id;
    }
  }
  
  // Create new match
  const newMatch = await addDoc(matchesRef, {
    users: [userId1, userId2],
    matchedAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: null,
    status: 'matched',
    unreadCount: {
      [userId1]: 0,
      [userId2]: 0
    }
  });
  
  console.log('New match created:', newMatch.id);
  return newMatch.id;
}

// Like Actions
export async function sendLike(fromUserId: string, toUserId: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  console.log('Sending like from:', fromUserId, 'to:', toUserId);
  
  try {
    const { getDocs, query, where } = await import('firebase/firestore');
    const likesRef = collection(db, 'likes');
    
    // Check if like already exists
    const existingLikeQuery = query(
      likesRef,
      where('from', '==', fromUserId),
      where('to', '==', toUserId)
    );
    const existingLikeSnapshot = await getDocs(existingLikeQuery);
    
    if (!existingLikeSnapshot.empty) {
      console.log('Like already exists');
      return { likeId: existingLikeSnapshot.docs[0].id, matchId: null, isMatch: false, alreadyLiked: true };
    }
    
    const newLike = await addDoc(likesRef, {
      from: fromUserId,
      to: toUserId,
      createdAt: serverTimestamp(),
      seen: false
    });
    
    console.log('Like created with ID:', newLike.id);
    
    // Check if there's a mutual like (they liked us back)
    const mutualLikeQuery = query(
      likesRef,
      where('from', '==', toUserId),
      where('to', '==', fromUserId)
    );
    
    const mutualLikeSnapshot = await getDocs(mutualLikeQuery);
    console.log('Checking mutual like from:', toUserId, 'to:', fromUserId);
    console.log('Mutual like found:', !mutualLikeSnapshot.empty);
    
    if (!mutualLikeSnapshot.empty) {
      // Mutual like exists, create a match
      console.log('Creating match between:', fromUserId, 'and', toUserId);
      const matchId = await createMatch(fromUserId, toUserId);
      return { likeId: newLike.id, matchId, isMatch: true, alreadyLiked: false };
    }
    
    return { likeId: newLike.id, matchId: null, isMatch: false, alreadyLiked: false };
  } catch (error: any) {
    console.error('Error sending like:', error);
    
    // ネットワークエラーの場合は適切なエラーメッセージを投げる
    if (error.code === 'unavailable' || 
        error.message.includes('503') || 
        error.message.includes('Service Unavailable')) {
      throw new Error('一時的にサービスが利用できません。しばらくしてから再度お試しください。');
    }
    
    // 認証エラーの場合
    if (error.code === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません。');
    }
    
    throw error;
  }
}

// Profile View Actions
export async function recordProfileView(viewerUserId: string, viewedUserId: string) {
  if (!db) throw new Error('Firestore is not initialized');
  
  // Don't record self-views
  if (viewerUserId === viewedUserId) return;
  
  try {
    // Record profile view without complex queries to avoid index requirements
    // We'll use a simple approach: just record all views
    await addDoc(collection(db, 'profileViews'), {
      viewerUserId,
      viewedUserId,
      viewedAt: serverTimestamp()
    });
  } catch (error: any) {
    console.error('Error recording profile view:', error);
    // Don't throw error for profile views as it's not critical
  }
}