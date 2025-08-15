import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './client';

export interface Memo {
  id: string;
  userId: string; // User who wrote the memo
  targetId: string; // Girl ID or profile ID
  targetName?: string; // Girl name for display
  targetImage?: string; // Girl image for display
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Create or update a memo
 */
export async function saveMemo(
  userId: string,
  targetId: string,
  content: string,
  targetName?: string,
  targetImage?: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  
  // Create a unique ID for the memo (userId_targetId)
  const memoId = `${userId}_${targetId}`;
  const memoRef = doc(db, 'memos', memoId);
  
  // Check if memo exists
  const existingMemo = await getDoc(memoRef);
  
  if (existingMemo.exists()) {
    // Update existing memo
    const updateData: any = {
      content,
      updatedAt: serverTimestamp()
    };
    
    // Only update targetName and targetImage if they are provided
    // This prevents overwriting existing values with undefined
    if (targetName !== undefined && targetName !== null) {
      updateData.targetName = targetName;
    }
    if (targetImage !== undefined && targetImage !== null) {
      updateData.targetImage = targetImage;
    }
    
    await setDoc(memoRef, updateData, { merge: true });
  } else {
    // Create new memo
    await setDoc(memoRef, {
      id: memoId,
      userId,
      targetId,
      targetName: targetName || '',
      targetImage: targetImage || '',
      content,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

/**
 * Get a specific memo
 */
export async function getMemo(userId: string, targetId: string): Promise<Memo | null> {
  if (!db) throw new Error('Firebase not initialized');
  
  const memoId = `${userId}_${targetId}`;
  const memoRef = doc(db, 'memos', memoId);
  const memoDoc = await getDoc(memoRef);
  
  if (memoDoc.exists()) {
    return memoDoc.data() as Memo;
  }
  
  return null;
}

/**
 * Get all memos for a user
 */
export async function getUserMemos(userId: string): Promise<Memo[]> {
  if (!db) throw new Error('Firebase not initialized');
  
  const memosRef = collection(db, 'memos');
  const q = query(
    memosRef, 
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const memos: Memo[] = [];
  
  querySnapshot.forEach(doc => {
    memos.push(doc.data() as Memo);
  });
  
  return memos;
}

/**
 * Delete a memo
 */
export async function deleteMemo(userId: string, targetId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  
  const memoId = `${userId}_${targetId}`;
  const memoRef = doc(db, 'memos', memoId);
  await deleteDoc(memoRef);
}