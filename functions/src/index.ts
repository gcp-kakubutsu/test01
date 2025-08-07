import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Get admin emails from environment configuration
const ADMIN_EMAILS = (functions.config().admin?.emails || '').split(',');

/**
 * Cloud Function to delete a post (admin only)
 * Callable function that can be invoked from the client
 */
export const deletePostAsAdmin = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to perform this action.'
    );
  }

  // Check if user is an admin
  const userEmail = context.auth.token.email;
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can delete posts.'
    );
  }

  // Get the post ID from the request
  const { postId } = data;
  if (!postId || typeof postId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid postId.'
    );
  }

  try {
    const db = admin.firestore();
    const postRef = db.collection('posts').doc(postId);
    
    // Check if post exists
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified post does not exist.'
      );
    }

    // Delete all comments in the subcollection first
    const commentsSnapshot = await postRef.collection('comments').get();
    const batch = db.batch();
    
    // Add all comment deletions to batch
    commentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Add post deletion to batch
    batch.delete(postRef);
    
    // Commit all deletions
    await batch.commit();

    // Log the admin action
    console.log(`Post ${postId} deleted by admin ${userEmail}`);

    return {
      success: true,
      message: 'Post and all comments deleted successfully',
      postId: postId,
      deletedBy: userEmail,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error deleting post:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while deleting the post.'
    );
  }
});

/**
 * Cloud Function to delete a comment (admin only)
 */
export const deleteCommentAsAdmin = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to perform this action.'
    );
  }

  // Check if user is an admin
  const userEmail = context.auth.token.email;
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can delete comments.'
    );
  }

  // Get the post ID and comment ID from the request
  const { postId, commentId } = data;
  if (!postId || !commentId || typeof postId !== 'string' || typeof commentId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with valid postId and commentId.'
    );
  }

  try {
    const db = admin.firestore();
    const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
    
    // Check if comment exists
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified comment does not exist.'
      );
    }

    // Delete the comment
    await commentRef.delete();

    // Update the comment count on the post
    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
      comments: admin.firestore.FieldValue.increment(-1)
    });

    // Log the admin action
    console.log(`Comment ${commentId} on post ${postId} deleted by admin ${userEmail}`);

    return {
      success: true,
      message: 'Comment deleted successfully',
      postId: postId,
      commentId: commentId,
      deletedBy: userEmail,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error deleting comment:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while deleting the comment.'
    );
  }
});

/**
 * Cloud Function to promote/demote admin status
 * Only existing admins can promote other users
 */
export const setAdminStatus = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to perform this action.'
    );
  }

  // Check if user is an admin
  const userEmail = context.auth.token.email;
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can manage admin status.'
    );
  }

  const { uid, isAdmin } = data;
  if (!uid || typeof uid !== 'string' || typeof isAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with valid uid and isAdmin status.'
    );
  }

  try {
    // Set custom claims for the user
    await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });

    // Log the admin action
    console.log(`User ${uid} admin status set to ${isAdmin} by ${userEmail}`);

    return {
      success: true,
      message: `User admin status ${isAdmin ? 'granted' : 'revoked'} successfully`,
      uid: uid,
      isAdmin: isAdmin,
      modifiedBy: userEmail,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error setting admin status:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while setting admin status.'
    );
  }
});

/**
 * Cloud Function to delete a community (admin or creator only)
 */
export const deleteCommunity = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to perform this action.'
    );
  }

  const { communityId } = data;
  if (!communityId || typeof communityId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid communityId.'
    );
  }

  try {
    const db = admin.firestore();
    const communityRef = db.collection('communities').doc(communityId);
    
    // Check if community exists
    const communityDoc = await communityRef.get();
    if (!communityDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified community does not exist.'
      );
    }

    const communityData = communityDoc.data();
    const userEmail = context.auth.token.email;
    const userId = context.auth.uid;

    // Check if user is admin or creator
    const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);
    const isCreator = communityData?.createdBy === userId;

    if (!isAdmin && !isCreator) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only administrators or the community creator can delete this community.'
      );
    }

    // Delete all posts in the community
    const postsSnapshot = await db.collection('posts')
      .where('communityId', '==', communityId)
      .get();

    const batch = db.batch();
    
    // Delete all posts and their comments
    for (const postDoc of postsSnapshot.docs) {
      // Delete comments subcollection
      const commentsSnapshot = await postDoc.ref.collection('comments').get();
      commentsSnapshot.docs.forEach(commentDoc => {
        batch.delete(commentDoc.ref);
      });
      
      // Delete the post
      batch.delete(postDoc.ref);
    }
    
    // Delete the community
    batch.delete(communityRef);
    
    // Commit all deletions
    await batch.commit();

    // Log the action
    console.log(`Community ${communityId} deleted by ${userEmail || userId}`);

    return {
      success: true,
      message: 'Community and all related content deleted successfully',
      communityId: communityId,
      deletedBy: userEmail || userId,
      isAdmin: isAdmin,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error deleting community:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while deleting the community.'
    );
  }
});