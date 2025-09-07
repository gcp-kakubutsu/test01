import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc, 
  query, 
  where, 
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';
import { generateUniquePaymentUid, validatePaymentUidFormat } from '@/utils/paymentUidGenerator';

// ユーザーデータに関する型定義
export interface UserPaymentInfo {
  payment_uid: string;
  payment_uid_created_at: Timestamp;
  payment_uid_updated_at: Timestamp;
}

export interface UserWithPaymentUid {
  id: string;
  payment_uid: string;
  payment_uid_created_at: Timestamp;
  payment_uid_updated_at: Timestamp;
  [key: string]: any; // その他のユーザーフィールド
}

// 処理結果の型定義
export interface PaymentUidOperationResult {
  success: boolean;
  userId?: string;
  payment_uid?: string;
  error?: string;
  timestamp: Date;
}

export interface BatchOperationResult {
  totalUsers: number;
  successCount: number;
  failureCount: number;
  errors: Array<{userId: string, error: string}>;
  duration: number;
}

/**
 * 新規ユーザーを作成し、payment_uidを自動付与する
 * @param userId ユーザーID
 * @param userData ユーザーデータ
 * @returns 操作結果
 */
export async function createUserWithPaymentUid(
  userId: string,
  userData: Record<string, any>
): Promise<PaymentUidOperationResult> {
  const startTime = Date.now();
  
  try {
    console.log(`👤 Creating user with payment_uid: ${userId}`);
    
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // ユニークなpayment_uidを生成
    const payment_uid = await generateUniquePaymentUid();
    console.log(`💳 Generated payment_uid for user ${userId}: ${payment_uid}`);
    
    // ユーザーデータにpayment_uid情報を追加
    const userWithPaymentUid = {
      ...userData,
      payment_uid,
      payment_uid_created_at: serverTimestamp(),
      payment_uid_updated_at: serverTimestamp(),
    };
    
    // Firestoreにユーザーを作成
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, userWithPaymentUid);
    
    console.log(`✅ Successfully created user ${userId} with payment_uid: ${payment_uid}`);
    
    return {
      success: true,
      userId,
      payment_uid,
      timestamp: new Date()
    };
    
  } catch (error) {
    const errorMessage = `Failed to create user with payment_uid: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMessage}`, error);
    
    return {
      success: false,
      userId,
      error: errorMessage,
      timestamp: new Date()
    };
  }
}

/**
 * 既存ユーザーにpayment_uidを追加する
 * @param userId ユーザーID
 * @returns 操作結果
 */
export async function addPaymentUidToExistingUser(userId: string): Promise<PaymentUidOperationResult> {
  try {
    console.log(`🔄 Adding payment_uid to existing user: ${userId}`);
    
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // ユーザーの存在確認
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} does not exist`);
    }
    
    const userData = userDoc.data();
    
    // 既にpayment_uidが存在する場合はスキップ
    if (userData.payment_uid) {
      console.log(`ℹ️  User ${userId} already has payment_uid: ${userData.payment_uid}`);
      return {
        success: true,
        userId,
        payment_uid: userData.payment_uid,
        timestamp: new Date()
      };
    }
    
    // ユニークなpayment_uidを生成
    const payment_uid = await generateUniquePaymentUid();
    console.log(`💳 Generated payment_uid for existing user ${userId}: ${payment_uid}`);
    
    // ユーザーデータを更新
    await updateDoc(userRef, {
      payment_uid,
      payment_uid_created_at: serverTimestamp(),
      payment_uid_updated_at: serverTimestamp(),
    });
    
    console.log(`✅ Successfully added payment_uid to user ${userId}: ${payment_uid}`);
    
    return {
      success: true,
      userId,
      payment_uid,
      timestamp: new Date()
    };
    
  } catch (error) {
    const errorMessage = `Failed to add payment_uid to existing user: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMessage}`, error);
    
    return {
      success: false,
      userId,
      error: errorMessage,
      timestamp: new Date()
    };
  }
}

/**
 * payment_uidでユーザーを検索する
 * @param paymentUid 検索するpayment_uid
 * @returns ユーザーデータまたはnull
 */
export async function getUserByPaymentUid(paymentUid: string): Promise<UserWithPaymentUid | null> {
  try {
    console.log(`🔍 Searching user by payment_uid: ${paymentUid}`);
    
    // バリデーション
    if (!validatePaymentUidFormat(paymentUid)) {
      throw new Error(`Invalid payment_uid format: ${paymentUid}`);
    }
    
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // payment_uidでクエリ
    const usersQuery = query(
      collection(db, 'users'),
      where('payment_uid', '==', paymentUid),
      limit(1)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    
    if (querySnapshot.empty) {
      console.log(`ℹ️  No user found with payment_uid: ${paymentUid}`);
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log(`✅ Found user with payment_uid ${paymentUid}: ${userDoc.id}`);
    
    return {
      id: userDoc.id,
      payment_uid: userData.payment_uid,
      payment_uid_created_at: userData.payment_uid_created_at,
      payment_uid_updated_at: userData.payment_uid_updated_at,
      ...userData
    };
    
  } catch (error) {
    console.error(`❌ Error searching user by payment_uid: ${error}`);
    throw new Error(`Failed to search user by payment_uid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 全既存ユーザーにpayment_uidを一括付与する
 * @param batchSize バッチサイズ（デフォルト: 10）
 * @returns 一括処理結果
 */
export async function addPaymentUidToAllUsers(batchSize: number = 10): Promise<BatchOperationResult> {
  const startTime = Date.now();
  const result: BatchOperationResult = {
    totalUsers: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    duration: 0
  };
  
  try {
    console.log(`🔄 Starting batch operation to add payment_uid to all users (batch size: ${batchSize})`);
    
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // payment_uidが存在しないユーザーを取得
    const usersQuery = query(
      collection(db, 'users'),
      where('payment_uid', '==', null)
    );
    
    // 代替クエリ: payment_uidフィールドが存在しないユーザーも取得
    const allUsersQuery = query(collection(db, 'users'));
    const querySnapshot = await getDocs(allUsersQuery);
    
    // payment_uidが存在しないユーザーをフィルタ
    const usersWithoutPaymentUid = querySnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.payment_uid;
    });
    
    result.totalUsers = usersWithoutPaymentUid.length;
    console.log(`📊 Found ${result.totalUsers} users without payment_uid`);
    
    if (result.totalUsers === 0) {
      console.log('ℹ️  All users already have payment_uid');
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // バッチ処理で更新
    for (let i = 0; i < usersWithoutPaymentUid.length; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = usersWithoutPaymentUid.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}: users ${i + 1}-${Math.min(i + batchSize, usersWithoutPaymentUid.length)}`);
      
      // 各ユーザーにpayment_uidを生成
      for (const userDoc of currentBatch) {
        try {
          const payment_uid = await generateUniquePaymentUid();
          
          batch.update(userDoc.ref, {
            payment_uid,
            payment_uid_created_at: serverTimestamp(),
            payment_uid_updated_at: serverTimestamp(),
          });
          
          console.log(`💳 Prepared payment_uid for user ${userDoc.id}: ${payment_uid}`);
          
        } catch (error) {
          const errorMessage = `Failed to generate payment_uid for user ${userDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMessage}`);
          result.errors.push({
            userId: userDoc.id,
            error: errorMessage
          });
          result.failureCount++;
          continue;
        }
      }
      
      // バッチをコミット
      try {
        await batch.commit();
        const successfulInBatch = currentBatch.length - result.errors.filter(e => 
          currentBatch.some(doc => doc.id === e.userId)
        ).length;
        result.successCount += successfulInBatch;
        
        console.log(`✅ Successfully processed batch: ${successfulInBatch}/${currentBatch.length} users`);
        
        // 短時間待機（Firestoreの負荷軽減）
        if (i + batchSize < usersWithoutPaymentUid.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        const errorMessage = `Batch commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMessage}`);
        
        // バッチ内の全ユーザーをエラーとして記録
        for (const userDoc of currentBatch) {
          result.errors.push({
            userId: userDoc.id,
            error: errorMessage
          });
          result.failureCount++;
        }
      }
    }
    
    result.duration = Date.now() - startTime;
    
    console.log(`📊 Batch operation completed:`);
    console.log(`  - Total users: ${result.totalUsers}`);
    console.log(`  - Successful: ${result.successCount}`);
    console.log(`  - Failed: ${result.failureCount}`);
    console.log(`  - Duration: ${result.duration}ms`);
    
    return result;
    
  } catch (error) {
    result.duration = Date.now() - startTime;
    const errorMessage = `Batch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

/**
 * payment_uid情報を更新する（既存のpayment_uidのタイムスタンプを更新）
 * @param userId ユーザーID
 * @returns 操作結果
 */
export async function updatePaymentUidTimestamp(userId: string): Promise<PaymentUidOperationResult> {
  try {
    console.log(`🔄 Updating payment_uid timestamp for user: ${userId}`);
    
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} does not exist`);
    }
    
    const userData = userDoc.data();
    
    if (!userData.payment_uid) {
      throw new Error(`User ${userId} does not have payment_uid`);
    }
    
    // タイムスタンプのみを更新
    await updateDoc(userRef, {
      payment_uid_updated_at: serverTimestamp(),
    });
    
    console.log(`✅ Successfully updated payment_uid timestamp for user ${userId}`);
    
    return {
      success: true,
      userId,
      payment_uid: userData.payment_uid,
      timestamp: new Date()
    };
    
  } catch (error) {
    const errorMessage = `Failed to update payment_uid timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ ${errorMessage}`, error);
    
    return {
      success: false,
      userId,
      error: errorMessage,
      timestamp: new Date()
    };
  }
}

/**
 * ユーザーのpayment_uid情報を取得する
 * @param userId ユーザーID
 * @returns payment_uid情報またはnull
 */
export async function getUserPaymentInfo(userId: string): Promise<UserPaymentInfo | null> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    
    if (!userData.payment_uid) {
      return null;
    }
    
    return {
      payment_uid: userData.payment_uid,
      payment_uid_created_at: userData.payment_uid_created_at,
      payment_uid_updated_at: userData.payment_uid_updated_at,
    };
    
  } catch (error) {
    console.error(`❌ Error getting user payment info: ${error}`);
    return null;
  }
}