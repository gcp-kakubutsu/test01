'use server';

import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';

export async function deleteAccount(userId: string) {
  try {
    // Delete from Firestore first
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);
    
    // Delete user document
    await userRef.delete();
    console.log('User deleted from Firestore: ', userId);
    
    // Delete from Firebase Auth
    const auth = getAdminAuth();
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