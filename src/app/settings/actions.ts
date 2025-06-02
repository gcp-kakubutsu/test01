'use server';

import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export async function deleteAccount(userId: string) {
  try {
    const adminApp = getApps().find(app => app.name === 'admin');
    if (!adminApp) {
      throw new Error('Firebase Admin SDK is not initialized');
    }
    
    // Delete from Firestore first
    const db = getFirestore(adminApp);
    const userRef = db.collection('users').doc(userId);
    
    // Delete user document
    await userRef.delete();
    console.log('User deleted from Firestore: ', userId);
    
    // Delete from Firebase Auth
    const auth = getAuth(adminApp);
    await auth.deleteUser(userId);
    console.log('User deleted from Firebase Auth: ', userId);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting account: ', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred' };
  }
}