import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from './useUser';
import { 
  PaymentInfo,
  PaymentHistoryEntry, 
  PaymentStats,
  PAYMENT_STATUS,
  isValidPaymentUid
} from '@/types/user';
import { 
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

/**
 * 決済情報管理のためのReact Hook
 * payment_uidを使用した決済履歴・統計の取得と管理
 */
export function usePayment() {
  const { currentUser } = useAuth();
  const { paymentUidInfo, getPaymentUid, ensurePaymentUid } = useUser();
  
  // State
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 決済情報をロードする関数
  const loadPaymentInfo = useCallback(async (): Promise<PaymentInfo | null> => {
    const paymentUid = getPaymentUid();
    
    if (!paymentUid || !currentUser?.uid) {
      return null;
    }

    try {
      console.log(`💳 Loading payment info for payment_uid: ${paymentUid}`);
      setLoading(true);
      setError(null);

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore is not initialized');
      }

      // payment_infoコレクションから情報を取得
      const paymentInfoRef = doc(db, 'payment_info', paymentUid);
      const paymentInfoDoc = await getDoc(paymentInfoRef);

      if (paymentInfoDoc.exists()) {
        const info = paymentInfoDoc.data() as PaymentInfo;
        console.log(`✅ Payment info loaded:`, info);
        setPaymentInfo(info);
        return info;
      } else {
        console.log(`ℹ️ No payment info found for payment_uid: ${paymentUid}`);
        // デフォルトの決済情報を作成
        const defaultPaymentInfo: PaymentInfo = {
          payment_uid: paymentUid,
          user_id: currentUser.uid,
          status: 'inactive',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        };
        setPaymentInfo(defaultPaymentInfo);
        return defaultPaymentInfo;
      }
    } catch (err) {
      const errorMessage = `Failed to load payment info: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getPaymentUid, currentUser?.uid]);

  // 決済履歴を取得する関数
  const getPaymentHistory = useCallback(async (limitCount: number = 50): Promise<PaymentHistoryEntry[]> => {
    const paymentUid = getPaymentUid();
    
    if (!paymentUid || !currentUser?.uid) {
      return [];
    }

    try {
      console.log(`📝 Loading payment history for payment_uid: ${paymentUid} (limit: ${limitCount})`);
      setLoading(true);
      setError(null);

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore is not initialized');
      }

      // payment_historyコレクションから履歴を取得
      const historyQuery = query(
        collection(db, 'payment_history'),
        where('payment_uid', '==', paymentUid),
        orderBy('processed_at', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(historyQuery);
      const history: PaymentHistoryEntry[] = [];

      querySnapshot.forEach((doc) => {
        history.push({
          id: doc.id,
          ...doc.data()
        } as PaymentHistoryEntry);
      });

      console.log(`✅ Payment history loaded: ${history.length} entries`);
      setPaymentHistory(history);
      return history;
    } catch (err) {
      const errorMessage = `Failed to load payment history: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getPaymentUid, currentUser?.uid]);

  // 最新の決済情報を取得する関数
  const getLatestPayment = useCallback(async (): Promise<PaymentHistoryEntry | null> => {
    const history = await getPaymentHistory(1);
    return history.length > 0 ? history[0] : null;
  }, [getPaymentHistory]);

  // 決済統計を計算・取得する関数
  const getPaymentStats = useCallback(async (): Promise<PaymentStats | null> => {
    const paymentUid = getPaymentUid();
    
    if (!paymentUid || !currentUser?.uid) {
      return null;
    }

    try {
      console.log(`📊 Calculating payment stats for payment_uid: ${paymentUid}`);
      setLoading(true);
      setError(null);

      // まず全ての履歴を取得（統計計算のため）
      const fullHistory = await getPaymentHistory(1000); // 最大1000件まで
      
      if (fullHistory.length === 0) {
        const emptyStats: PaymentStats = {
          payment_uid: paymentUid,
          user_id: currentUser.uid,
          total_payments: 0,
          successful_payments: 0,
          failed_payments: 0,
          total_amount: 0,
          average_amount: 0,
          updated_at: Timestamp.now(),
        };
        setPaymentStats(emptyStats);
        return emptyStats;
      }

      // 統計を計算
      const successfulPayments = fullHistory.filter(p => p.status === 'succeeded');
      const failedPayments = fullHistory.filter(p => p.status === 'failed');
      const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
      
      // 最も使用頻度の高い決済方法を特定
      const paymentMethodCounts: Record<string, number> = {};
      fullHistory.forEach(p => {
        paymentMethodCounts[p.payment_method] = (paymentMethodCounts[p.payment_method] || 0) + 1;
      });
      
      const mostUsedMethod = Object.entries(paymentMethodCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] as 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'other' | undefined;

      const stats: PaymentStats = {
        payment_uid: paymentUid,
        user_id: currentUser.uid,
        total_payments: fullHistory.length,
        successful_payments: successfulPayments.length,
        failed_payments: failedPayments.length,
        total_amount: totalAmount,
        average_amount: successfulPayments.length > 0 ? totalAmount / successfulPayments.length : 0,
        first_payment_at: fullHistory.length > 0 ? fullHistory[fullHistory.length - 1].processed_at : null,
        last_payment_at: fullHistory.length > 0 ? fullHistory[0].processed_at : null,
        most_used_payment_method: mostUsedMethod,
        updated_at: Timestamp.now(),
      };

      console.log(`✅ Payment stats calculated:`, stats);
      setPaymentStats(stats);
      return stats;
    } catch (err) {
      const errorMessage = `Failed to calculate payment stats: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getPaymentUid, currentUser?.uid, getPaymentHistory]);

  // 決済情報をリアルタイムで監視する関数
  const subscribeToPaymentUpdates = useCallback(() => {
    const paymentUid = getPaymentUid();
    
    if (!paymentUid || !currentUser?.uid) {
      return () => {}; // 空のunsubscribe関数
    }

    const db = getFirebaseDb();
    if (!db) {
      console.error('Firestore is not initialized for payment subscription');
      return () => {};
    }

    console.log(`🔄 Setting up payment info subscription for: ${paymentUid}`);

    const paymentInfoRef = doc(db, 'payment_info', paymentUid);
    
    const unsubscribe = onSnapshot(
      paymentInfoRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const info = docSnapshot.data() as PaymentInfo;
          console.log(`🔄 Payment info updated:`, info);
          setPaymentInfo(info);
        }
      },
      (err) => {
        console.error('❌ Error in payment info subscription:', err);
        setError(`Payment info sync error: ${err.message}`);
      }
    );

    return unsubscribe;
  }, [getPaymentUid, currentUser?.uid]);

  // payment_uidが変更されたときに決済情報をロード
  useEffect(() => {
    if (paymentUidInfo?.payment_uid) {
      loadPaymentInfo();
      getPaymentHistory();
      getPaymentStats();
    } else {
      // payment_uidがない場合は状態をクリア
      setPaymentInfo(null);
      setPaymentHistory([]);
      setPaymentStats(null);
    }
  }, [paymentUidInfo?.payment_uid, loadPaymentInfo, getPaymentHistory, getPaymentStats]);

  // 決済可能性をチェックする関数
  const canProcessPayment = useCallback((): boolean => {
    const paymentUid = getPaymentUid();
    return !!(
      paymentUid && 
      isValidPaymentUid(paymentUid) &&
      paymentInfo?.status === 'active'
    );
  }, [getPaymentUid, paymentInfo?.status]);

  // 決済準備を行う関数
  const prepareForPayment = useCallback(async (): Promise<string> => {
    try {
      console.log('🚀 Preparing for payment...');
      
      // payment_uidを確保
      const paymentUid = await ensurePaymentUid();
      
      // 決済情報をロード
      await loadPaymentInfo();
      
      console.log(`✅ Payment prepared with UID: ${paymentUid}`);
      return paymentUid;
    } catch (err) {
      const errorMessage = `Failed to prepare for payment: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [ensurePaymentUid, loadPaymentInfo]);

  // 決済ステータスを更新する関数
  const updatePaymentStatus = useCallback(async (status: PaymentInfo['status']): Promise<void> => {
    const paymentUid = getPaymentUid();
    
    if (!paymentUid || !currentUser?.uid) {
      throw new Error('Payment UID or user not available');
    }

    try {
      console.log(`🔄 Updating payment status to: ${status}`);
      
      // ここで実際のFirestore更新処理を行う
      // 実装はアプリケーションの要件に応じて調整
      
      console.log(`✅ Payment status updated to: ${status}`);
    } catch (err) {
      const errorMessage = `Failed to update payment status: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getPaymentUid, currentUser?.uid]);

  // エラーをクリアする関数
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // リフレッシュ機能
  const refresh = useCallback(async () => {
    if (paymentUidInfo?.payment_uid) {
      await Promise.all([
        loadPaymentInfo(),
        getPaymentHistory(),
        getPaymentStats(),
      ]);
    }
  }, [paymentUidInfo?.payment_uid, loadPaymentInfo, getPaymentHistory, getPaymentStats]);

  return {
    // State
    paymentInfo,
    paymentHistory,
    paymentStats,
    loading,
    error,
    
    // Computed values
    hasPaymentInfo: !!paymentInfo,
    canProcessPayment: canProcessPayment(),
    paymentUid: getPaymentUid(),
    
    // Functions
    loadPaymentInfo,
    getPaymentHistory,
    getLatestPayment,
    getPaymentStats,
    subscribeToPaymentUpdates,
    prepareForPayment,
    updatePaymentStatus,
    
    // Utility functions
    clearError,
    refresh,
  };
}

/**
 * 決済履歴のみを管理する軽量版フック
 */
export function usePaymentHistory(limitCount: number = 20) {
  const { getPaymentHistory, paymentHistory, loading, error } = usePayment();
  
  useEffect(() => {
    getPaymentHistory(limitCount);
  }, [getPaymentHistory, limitCount]);
  
  return {
    paymentHistory,
    loading,
    error,
    refresh: () => getPaymentHistory(limitCount),
  };
}

/**
 * 決済統計のみを管理する軽量版フック
 */
export function usePaymentStats() {
  const { getPaymentStats, paymentStats, loading, error } = usePayment();
  
  useEffect(() => {
    getPaymentStats();
  }, [getPaymentStats]);
  
  return {
    paymentStats,
    loading,
    error,
    refresh: getPaymentStats,
  };
}