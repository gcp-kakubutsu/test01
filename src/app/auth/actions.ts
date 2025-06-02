
'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';


export async function addUserToFirestore(userId: string, username: string, email: string, birthDate?: string, gender?: string) {
  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);
    
    await userRef.set({
      uid: userId,
      username: username,
      email: email,
      birthDate: birthDate || null,
      gender: gender || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Add any other default fields here
      bio: '',
      kinks: [],
      profilePhotoUrl: '',
      age: null,
    });
    
    console.log('User added to Firestore with ID: ', userId);
    return { success: true, userId };
  } catch (error) {
    console.error('Error adding user to Firestore: ', error);
    // It's better to return a serializable error object
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred' };
  }
}
