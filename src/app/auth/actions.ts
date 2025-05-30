
'use server';

import { doc, setDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if not already initialized
// This should only run on the server
if (!getApps().some(app => app.name === 'admin')) {
  // Note: You'll need to set up Google Application Credentials for this to work in deployed environments.
  // For local development, you can use a service account JSON file.
  // Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is set or initialize with cert()
  // Example:
  // const serviceAccount = require('/path/to/your/serviceAccountKey.json');
  // initializeApp({ credential: cert(serviceAccount) }, 'admin');
  // For Firebase Studio environment, it might be auto-configured or require specific env vars.
  // For now, we assume it's configured if deployed to a Firebase environment.
  // If running locally without GOOGLE_APPLICATION_CREDENTIALS, this might fail.
  try {
     initializeApp(undefined, 'admin');
  } catch (e) {
    console.warn("Firebase Admin SDK not initialized. Ensure GOOGLE_APPLICATION_CREDENTIALS is set for server actions or provide a service account key for local development.", e);
  }
}


export async function addUserToFirestore(userId: string, username: string, email: string) {
  try {
    const adminDb = getAdminFirestore(getApps().find(app => app.name === 'admin'));
    const userRef = doc(adminDb, 'users', userId);
    await setDoc(userRef, {
      uid: userId,
      username: username,
      email: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
