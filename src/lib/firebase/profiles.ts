import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './client';

/**
 * Update user profile in Firestore
 * @param userId - The user ID
 * @param data - The profile data to update
 */
export async function updateProfile(userId: string, data: Record<string, any>) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}