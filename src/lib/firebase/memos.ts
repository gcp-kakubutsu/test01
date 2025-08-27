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
import { getFirebaseDb } from './client';

export interface Memo {
  id: string;
  userId: string; // User who wrote the memo
  targetId: string; // Girl ID or profile ID
  targetName?: string; // Girl name for display
  targetImage?: string; // Girl image for display
  targetLocation?: string; // Girl location for search
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
  targetImage?: string,
  targetLocation?: string
): Promise<void> {
  // LINEブラウザの場合、Firebase初期化を待つ
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (isLineBrowser) {
    console.log('[saveMemo] LINE browser detected, waiting for Firebase...');
    const { waitForFirebaseInLine } = await import('./line-auth-helper');
    const initialized = await waitForFirebaseInLine();
    if (!initialized) {
      console.error('[saveMemo] Firebase initialization failed');
      throw new Error('Firebaseの初期化に失敗しました。ページを再読み込みしてください。');
    }
    console.log('[saveMemo] Firebase initialized successfully');
  }
  
  // dbを取得
  const db = getFirebaseDb();
  
  if (!db) {
    console.error('[saveMemo] Firestore is null after initialization');
    throw new Error('Firebase not initialized');
  }
  
  console.log('[saveMemo] Using Firestore instance:', !!db);
  
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
    
    // Only update targetName, targetImage, and targetLocation if they are provided
    // This prevents overwriting existing values with undefined
    if (targetName !== undefined && targetName !== null) {
      updateData.targetName = targetName;
    }
    if (targetImage !== undefined && targetImage !== null) {
      updateData.targetImage = targetImage;
    }
    if (targetLocation !== undefined && targetLocation !== null) {
      updateData.targetLocation = targetLocation;
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
      targetLocation: targetLocation || '',
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
  console.log('[getMemo] Starting with:', { userId, targetId });
  
  // LINEブラウザの場合、Firebase初期化を待つ
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (isLineBrowser) {
    console.log('[getMemo] LINE browser detected, waiting for Firebase...');
    const { waitForFirebaseInLine } = await import('./line-auth-helper');
    const initialized = await waitForFirebaseInLine();
    if (!initialized) {
      console.error('[getMemo] Firebase initialization failed');
      throw new Error('Firebaseの初期化に失敗しました。ページを再読み込みしてください。');
    }
    console.log('[getMemo] Firebase initialized successfully');
  }
  
  const db = getFirebaseDb();
  console.log('[getMemo] Firestore instance:', !!db);
  if (!db) throw new Error('Firebase not initialized');
  
  const memoId = `${userId}_${targetId}`;
  console.log('[getMemo] Fetching memo with ID:', memoId);
  
  try {
    const memoRef = doc(db, 'memos', memoId);
    const memoDoc = await getDoc(memoRef);
    
    console.log('[getMemo] Memo doc exists:', memoDoc.exists());
    
    if (memoDoc.exists()) {
      const data = memoDoc.data() as Memo;
      console.log('[getMemo] Memo data found:', data);
      return data;
    }
    
    console.log('[getMemo] No memo found for ID:', memoId);
    return null;
  } catch (error: any) {
    console.error('[getMemo] Error fetching memo:', error);
    console.error('[getMemo] Error details:', {
      code: error?.code,
      message: error?.message,
      memoId
    });
    throw error;
  }
}

/**
 * Get all memos for a user
 */
export async function getUserMemos(userId: string): Promise<Memo[]> {
  // LINEブラウザの場合、Firebase初期化を待つ
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (isLineBrowser) {
    const { waitForFirebaseInLine } = await import('./line-auth-helper');
    const initialized = await waitForFirebaseInLine();
    if (!initialized) {
      throw new Error('Firebaseの初期化に失斗しました。ページを再読み込みしてください。');
    }
  }
  
  const db = getFirebaseDb();
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
  // LINEブラウザの場合、Firebase初期化を待つ
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (isLineBrowser) {
    const { waitForFirebaseInLine } = await import('./line-auth-helper');
    const initialized = await waitForFirebaseInLine();
    if (!initialized) {
      throw new Error('Firebaseの初期化に失敗しました。ページを再読み込みしてください。');
    }
  }
  
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');
  
  const memoId = `${userId}_${targetId}`;
  const memoRef = doc(db, 'memos', memoId);
  await deleteDoc(memoRef);
}