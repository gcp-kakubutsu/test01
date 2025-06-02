'use server';

import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export async function updateUserProfile(userId: string, data: {
  username?: string;
  bio?: string;
  location?: string;
  occupation?: string;
  interests?: string[];
  profilePhotoUrl?: string;
}) {
  try {
    const adminApp = getApps().find(app => app.name === 'admin');
    if (!adminApp) {
      throw new Error('Firebase Admin SDK is not initialized');
    }
    
    const db = getFirestore(adminApp);
    const userRef = db.collection('users').doc(userId);
    
    await userRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
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