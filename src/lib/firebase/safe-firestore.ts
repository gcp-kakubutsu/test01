import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  QueryConstraint,
  DocumentData,
  DocumentReference,
  CollectionReference,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from './client';

/**
 * Safe wrapper for Firestore operations that handles permission errors gracefully
 */

export async function safeGetDoc<T = DocumentData>(
  docRef: DocumentReference<T>
): Promise<DocumentSnapshot<T> | null> {
  try {
    if (!db) {
      console.warn('Firestore not initialized');
      return null;
    }
    return await getDoc(docRef);
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for document read:', docRef.path);
      return null;
    }
    console.error('Error reading document:', error);
    throw error;
  }
}

export async function safeGetDocs<T = DocumentData>(
  queryRef: CollectionReference<T> | ReturnType<typeof query>
): Promise<QuerySnapshot<T> | null> {
  try {
    if (!db) {
      console.warn('Firestore not initialized');
      return null;
    }
    return await getDocs(queryRef as any);
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for collection read');
      return null;
    }
    console.error('Error reading collection:', error);
    throw error;
  }
}

export async function safeSetDoc<T = DocumentData>(
  docRef: DocumentReference<T>,
  data: T,
  options?: any
): Promise<boolean> {
  try {
    if (!db) {
      console.warn('Firestore not initialized');
      return false;
    }
    await setDoc(docRef, data, options);
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for document write:', docRef.path);
      return false;
    }
    console.error('Error writing document:', error);
    throw error;
  }
}

export async function safeUpdateDoc<T = DocumentData>(
  docRef: DocumentReference<T>,
  data: Partial<T>
): Promise<boolean> {
  try {
    if (!db) {
      console.warn('Firestore not initialized');
      return false;
    }
    await updateDoc(docRef, data as any);
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for document update:', docRef.path);
      return false;
    }
    console.error('Error updating document:', error);
    throw error;
  }
}

export async function safeDeleteDoc<T = DocumentData>(
  docRef: DocumentReference<T>
): Promise<boolean> {
  try {
    if (!db) {
      console.warn('Firestore not initialized');
      return false;
    }
    await deleteDoc(docRef);
    return true;
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for document delete:', docRef.path);
      return false;
    }
    console.error('Error deleting document:', error);
    throw error;
  }
}

/**
 * Create a safe query that won't throw permission errors
 */
export function safeQuery<T = DocumentData>(
  collectionRef: CollectionReference<T>,
  ...queryConstraints: QueryConstraint[]
) {
  if (!db) {
    console.warn('Firestore not initialized');
    return null;
  }
  
  try {
    return query(collectionRef, ...queryConstraints);
  } catch (error) {
    console.error('Error creating query:', error);
    return null;
  }
}

/**
 * Check if Firestore is available and initialized
 */
export function isFirestoreAvailable(): boolean {
  return db !== null && db !== undefined;
}