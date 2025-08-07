import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';

// Initialize Firebase Admin
initAdmin();

const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',') || [];

export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const auth = getAuth();
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userEmail = decodedToken.email;
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get post ID from request body
    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'Bad Request: postId is required' },
        { status: 400 }
      );
    }

    // Delete the post using admin SDK (bypasses security rules)
    const db = getFirestore();
    const postRef = db.collection('posts').doc(postId);
    
    // Check if post exists
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      return NextResponse.json(
        { error: 'Not Found: Post does not exist' },
        { status: 404 }
      );
    }

    // Delete the post
    await postRef.delete();

    // Also delete all comments (subcollection)
    const commentsSnapshot = await postRef.collection('comments').get();
    const batch = db.batch();
    commentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json(
      { 
        success: true, 
        message: 'Post and comments deleted successfully',
        deletedBy: userEmail 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Admin delete post error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}