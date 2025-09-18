import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  PaymentUidInfo, 
  UserWithPaymentUid, 
  hasPaymentUid,
  isValidPaymentUid 
} from '@/types/user';
import { 
  addPaymentUidToExistingUser,
  getUserPaymentInfo,
  updatePaymentUidTimestamp 
} from '@/services/userService';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

/**
 * ユーザー情報管理のためのReact Hook
 * payment_uid関連機能を含む包括的なユーザー管理機能を提供
 */
export function useUser() {
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentUidInfo, setPaymentUidInfo] = useState<PaymentUidInfo | null>(null);
  const [isGeneratingPaymentUid, setIsGeneratingPaymentUid] = useState(false);

  // ユーザーデータをリアルタイムで監視
  useEffect(() => {
    if (!currentUser?.uid) {
      setUser(null);
      setPaymentUidInfo(null);
      setLoading(false);
      setError(null);
      return;
    }

    console.log(`👤 Setting up user data listener for: ${currentUser.uid}`);
    setLoading(true);
    setError(null);

    const db = getFirebaseDb();
    if (!db) {
      setError('Firestore is not initialized');
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    
    const unsubscribe = onSnapshot(
      userRef,
      (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
            const snapshotData = docSnapshot.data() as User;
            const userData: User = {
              ...snapshotData,
              uid: snapshotData.uid ?? currentUser.uid
            };
            console.log(`✅ User data loaded: ${userData.uid}`, {
              hasPaymentUid: !!userData.payment_uid,
              paymentUid: userData.payment_uid
            });
            
            setUser(userData);
            
            // payment_uid情報を抽出
            if (userData.payment_uid) {
              setPaymentUidInfo({
                payment_uid: userData.payment_uid,
                payment_uid_created_at: userData.payment_uid_created_at,
                payment_uid_updated_at: userData.payment_uid_updated_at,
              });
            } else {
              setPaymentUidInfo(null);
            }
          } else {
            console.warn(`⚠️ User document not found: ${currentUser.uid}`);
            setUser(null);
            setPaymentUidInfo(null);
          }
          setLoading(false);
        } catch (err) {
          console.error('❌ Error processing user data:', err);
          setError(`Failed to load user data: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ Error in user data listener:', err);
        setError(`Failed to sync user data: ${err.message}`);
        setLoading(false);
      }
    );

    return () => {
      console.log(`🔄 Cleaning up user data listener for: ${currentUser.uid}`);
      unsubscribe();
    };
  }, [currentUser?.uid]);

  // payment_uidを取得する関数
  const getPaymentUid = useCallback((): string | null => {
    return user?.payment_uid || null;
  }, [user?.payment_uid]);

  // payment_uidが存在するかチェックする関数
  const hasPaymentUidValue = useCallback((): boolean => {
    return !!(user && hasPaymentUid(user));
  }, [user]);

  // payment_uid詳細情報を取得する関数
  const getPaymentUidInfo = useCallback(async (): Promise<PaymentUidInfo | null> => {
    if (!currentUser?.uid) {
      return null;
    }

    try {
      console.log(`🔍 Fetching payment_uid info for user: ${currentUser.uid}`);
      const paymentInfo = await getUserPaymentInfo(currentUser.uid);
      
      if (paymentInfo) {
        console.log(`✅ Payment info loaded: ${paymentInfo.payment_uid}`);
        setPaymentUidInfo(paymentInfo);
        return paymentInfo;
      } else {
        console.log(`ℹ️ No payment info found for user: ${currentUser.uid}`);
        setPaymentUidInfo(null);
        return null;
      }
    } catch (err) {
      console.error('❌ Error fetching payment_uid info:', err);
      const errorMessage = `Failed to fetch payment info: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentUser?.uid]);

  // payment_uidを自動生成する関数
  const generatePaymentUid = useCallback(async (): Promise<string | null> => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    if (isGeneratingPaymentUid) {
      console.log('⏳ Payment UID generation already in progress');
      return null;
    }

    try {
      setIsGeneratingPaymentUid(true);
      setError(null);

      console.log(`🔄 Generating payment_uid for user: ${currentUser.uid}`);
      
      // 既にpayment_uidがある場合はそれを返す
      if (user?.payment_uid && isValidPaymentUid(user.payment_uid)) {
        console.log(`ℹ️ User already has valid payment_uid: ${user.payment_uid}`);
        return user.payment_uid;
      }

      // payment_uidを生成・追加
      const result = await addPaymentUidToExistingUser(currentUser.uid);
      
      if (result.success && result.payment_uid) {
        console.log(`✅ Successfully generated payment_uid: ${result.payment_uid}`);
        return result.payment_uid;
      } else {
        const errorMessage = result.error || 'Failed to generate payment_uid';
        console.error(`❌ ${errorMessage}`);
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = `Failed to generate payment_uid: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGeneratingPaymentUid(false);
    }
  }, [currentUser?.uid, user?.payment_uid, isGeneratingPaymentUid]);

  // payment_uidのタイムスタンプを更新する関数
  const updatePaymentUidTime = useCallback(async (): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`🔄 Updating payment_uid timestamp for user: ${currentUser.uid}`);
      
      const result = await updatePaymentUidTimestamp(currentUser.uid);
      
      if (result.success) {
        console.log(`✅ Successfully updated payment_uid timestamp`);
      } else {
        const errorMessage = result.error || 'Failed to update payment_uid timestamp';
        console.error(`❌ ${errorMessage}`);
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = `Failed to update payment_uid timestamp: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentUser?.uid]);

  // ユーザープロフィールを更新する関数
  const updateProfile = useCallback(async (updates: Partial<User>): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    if (!user) {
      throw new Error('User data not loaded');
    }

    try {
      console.log(`🔄 Updating user profile for: ${currentUser.uid}`, updates);
      setError(null);

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore is not initialized');
      }

      const userRef = doc(db, 'users', currentUser.uid);
      
      // updatedAtを自動追加
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      await updateDoc(userRef, updateData);
      
      console.log(`✅ Successfully updated user profile`);
    } catch (err) {
      const errorMessage = `Failed to update profile: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentUser?.uid, user]);

  // 自動的にpayment_uidを確保する関数
  const ensurePaymentUid = useCallback(async (): Promise<string> => {
    const existingPaymentUid = getPaymentUid();
    
    if (existingPaymentUid && isValidPaymentUid(existingPaymentUid)) {
      return existingPaymentUid;
    }

    const newPaymentUid = await generatePaymentUid();
    
    if (!newPaymentUid) {
      throw new Error('Failed to ensure payment_uid');
    }

    return newPaymentUid;
  }, [getPaymentUid, generatePaymentUid]);

  // エラーをクリアする関数
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // リフレッシュ機能
  const refresh = useCallback(async () => {
    if (currentUser?.uid) {
      await getPaymentUidInfo();
    }
  }, [currentUser?.uid, getPaymentUidInfo]);

  return {
    // State
    user,
    loading,
    error,
    paymentUidInfo,
    isGeneratingPaymentUid,
    
    // Computed values
    isAuthenticated: !!currentUser && !!user,
    userWithPaymentUid: (user && hasPaymentUid(user) ? user : null) as UserWithPaymentUid | null,
    
    // Payment UID functions
    getPaymentUid,
    hasPaymentUid: hasPaymentUidValue,
    getPaymentUidInfo,
    generatePaymentUid,
    updatePaymentUidTime,
    ensurePaymentUid,
    
    // Profile functions
    updateProfile,
    
    // Utility functions
    clearError,
    refresh,
  };
}

/**
 * payment_uidの状態のみを管理する軽量版フック
 */
export function usePaymentUid() {
  const { getPaymentUid, hasPaymentUid, generatePaymentUid, ensurePaymentUid, paymentUidInfo, isGeneratingPaymentUid, error } = useUser();
  
  return {
    paymentUid: getPaymentUid(),
    hasPaymentUid: hasPaymentUid(),
    paymentUidInfo,
    generatePaymentUid,
    ensurePaymentUid,
    isGeneratingPaymentUid,
    error,
  };
}
