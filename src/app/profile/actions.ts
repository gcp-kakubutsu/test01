'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function updateUserProfile(userId: string, data: {
  username?: string;
  bio?: string;
  location?: string;
  occupation?: string;
  interests?: string[];
  profilePhotoUrl?: string;
  additionalPhotos?: string[];
}) {
  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);
    
    // Check if document exists
    const doc = await userRef.get();
    
    if (!doc.exists) {
      // Create new document with all required fields
      await userRef.set({
        ...data,
        userId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Update existing document
      await userRef.update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    console.log('User profile updated: ', userId);
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile: ', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred' };
  }
}