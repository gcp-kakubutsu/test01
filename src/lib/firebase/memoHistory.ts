import { 
  collection, 
  addDoc, 
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { getFirebaseDb } from './client';

export interface MemoHistory {
  id?: string;
  userId: string; // User who wrote the memo
  targetId: string; // Girl ID or profile ID
  targetName?: string; // Girl name for display
  targetImage?: string; // Girl image for display
  targetLocation?: string; // Girl location for search
  content: string;
  date: string; // Date in YYYY-MM-DD format for grouping
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Add a new memo to history
 */
export async function addMemoToHistory(
  userId: string,
  targetId: string,
  content: string,
  targetName?: string,
  targetImage?: string,
  targetLocation?: string
): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const memoData = {
    userId,
    targetId,
    targetName: targetName || '',
    targetImage: targetImage || '',
    targetLocation: targetLocation || '',
    content,
    date: today,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(collection(db, 'memoHistory'), memoData);
  return docRef.id;
}

/**
 * Update existing memo in history
 */
export async function updateMemoInHistory(
  memoId: string,
  content: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const memoRef = doc(db, 'memoHistory', memoId);
  await updateDoc(memoRef, {
    content,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get memo history for a specific target
 */
export async function getMemoHistory(
  userId: string,
  targetId: string
): Promise<MemoHistory[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const memosRef = collection(db, 'memoHistory');
  const q = query(
    memosRef,
    where('userId', '==', userId),
    where('targetId', '==', targetId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const memos: MemoHistory[] = [];
  
  querySnapshot.forEach(doc => {
    memos.push({
      id: doc.id,
      ...doc.data()
    } as MemoHistory);
  });
  
  return memos;
}

/**
 * Get today's memo for a target
 */
export async function getTodaysMemo(
  userId: string,
  targetId: string
): Promise<MemoHistory | null> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const today = new Date().toISOString().split('T')[0];
  
  const memosRef = collection(db, 'memoHistory');
  const q = query(
    memosRef,
    where('userId', '==', userId),
    where('targetId', '==', targetId),
    where('date', '==', today),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as MemoHistory;
}

/**
 * Get all memo history for a user
 */
export async function getAllMemoHistory(userId: string): Promise<MemoHistory[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const memosRef = collection(db, 'memoHistory');
  const q = query(
    memosRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const memos: MemoHistory[] = [];
  
  querySnapshot.forEach(doc => {
    memos.push({
      id: doc.id,
      ...doc.data()
    } as MemoHistory);
  });
  
  return memos;
}

/**
 * Delete a memo from history
 */
export async function deleteMemoFromHistory(memoId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const memoRef = doc(db, 'memoHistory', memoId);
  await deleteDoc(memoRef);
}