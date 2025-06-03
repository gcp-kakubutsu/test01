import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { fromUserId, toUserId } = data;

    if (!fromUserId || !toUserId) {
      return NextResponse.json(
        { success: false, error: 'Required fields are missing' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // Check if like already exists
    const likesSnapshot = await db.collection('likes')
      .where('from', '==', fromUserId)
      .where('to', '==', toUserId)
      .get();
    
    if (!likesSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Like already exists' },
        { status: 400 }
      );
    }

    // Create like
    const likeRef = await db.collection('likes').add({
      from: fromUserId,
      to: toUserId,
      createdAt: FieldValue.serverTimestamp(),
      seen: false
    });

    // Check for mutual like
    const mutualLikeSnapshot = await db.collection('likes')
      .where('from', '==', toUserId)
      .where('to', '==', fromUserId)
      .get();

    let matchId = null;
    if (!mutualLikeSnapshot.empty) {
      // Create match
      const matchRef = await db.collection('matches').add({
        users: [fromUserId, toUserId],
        matchedAt: FieldValue.serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
        status: 'matched',
        unreadCount: {
          [fromUserId]: 0,
          [toUserId]: 0
        }
      });
      matchId = matchRef.id;
    }

    return NextResponse.json({
      success: true,
      likeId: likeRef.id,
      matchId,
      isMatch: !!matchId
    });
  } catch (error: any) {
    console.error('Error simulating like:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error simulating like' },
      { status: 500 }
    );
  }
}