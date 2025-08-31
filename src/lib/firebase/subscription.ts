import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';
import {
  UserWithSubscription,
  TrialData,
  SubscriptionData,
  BillingData,
  Payment,
  Subscription,
  SubscriptionBasicInfo,
  SubscriptionManagementInfo,
  SubscriptionSchedule,
  CancellationInfo,
  SUBSCRIPTION_CONSTANTS
} from '@/types/subscription';
import { createTrialData, createDefaultSubscriptionData } from '@/utils/subscription';

/**
 * 新規ユーザーのトライアルを初期化
 */
export async function initializeUserTrial(userId: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      return;
    }
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return;
    }
    
    const userData = userDoc.data();
    
    // すでにトライアルを使用済みの場合はスキップ
    if (userData.trial?.hasUsed) {
      return;
    }
    
    // トライアルデータを作成
    const trialData = createTrialData();
    const subscriptionData = createDefaultSubscriptionData();
    
    // Firestoreに保存
    await updateDoc(userRef, {
      ...trialData,
      ...subscriptionData,
      updatedAt: serverTimestamp()
    });
  } catch (error: any) {
    // 権限エラーの場合は静かに処理
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions')) {
      // Expected for new users - ignore
      return;
    }
    // その他のエラーも静かに処理
    return;
  }
}

/**
 * ユーザーのサブスクリプション情報を取得
 */
export async function getUserSubscriptionData(userId: string): Promise<UserWithSubscription | null> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      return null;
    }
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const data = userDoc.data();
    
    // デフォルト値を設定
    const defaultTrial: TrialData = {
      startDate: null,
      endDate: null,
      isActive: false,
      hasUsed: false,
      source: undefined
    };
    
    let defaultSubscription: SubscriptionData = {
      status: 'none',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      pausedAt: null
    };
    
    const defaultBilling: BillingData = {
      customerId: null,
      paymentMethodId: null,
      lastPaymentDate: null,
      nextBillingDate: null
    };
    
    // スクリプト(bulk)で作成されたプレミアムフィールドを正規化
    // トップレベルに subscriptionStartDate / subscriptionEndDate が存在する場合、
    // 型に合わせて subscription フィールドへマッピングする
    const hasScriptSubscriptionEnd = !!(data as any)?.subscriptionEndDate;
    let normalizedSubscription: SubscriptionData;
    const isSubscriptionTrial = (data as any)?.subscription?.status === 'trial';
    if (hasScriptSubscriptionEnd && !isSubscriptionTrial) {
      // スクリプト起源の有料はトップレベルの期間情報を最優先で採用
      normalizedSubscription = {
        status: 'active',
        currentPeriodStart: (data as any)?.subscriptionStartDate || null,
        currentPeriodEnd: (data as any)?.subscriptionEndDate || null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        pausedAt: null
      };
    } else {
      normalizedSubscription = data.subscription || defaultSubscription;
    }

    // スクリプト由来のisPremiumがtrueの場合は、トライアルを無効として扱う
    const scriptIsPremium = !!data.isPremium;
    const trialFromData: TrialData | undefined = data.trial;
    // トップレベルのsubscriptionEndDateが存在する場合のみ、スクリプト由来のプレミアムと判断してトライアルを無効化
    const disableTrialForScriptPremium = scriptIsPremium && hasScriptSubscriptionEnd && !isSubscriptionTrial;
    const normalizedTrial: TrialData = disableTrialForScriptPremium
      ? {
          startDate: trialFromData?.startDate || null,
          endDate: trialFromData?.endDate || null,
          isActive: false,
          hasUsed: true,
          source: trialFromData?.source
        }
      : (trialFromData || defaultTrial);

    // 新しいサブスクリプション情報のデフォルト値
    const defaultSubscriptionBasic: SubscriptionBasicInfo = {
      planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE,
      status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.NONE,
      startDate: normalizedSubscription.currentPeriodStart || Timestamp.now(),
      endDate: normalizedSubscription.currentPeriodEnd,
      autoRenew: false,
      trialEndDate: normalizedTrial.endDate
    };
    
    const defaultCancellation: CancellationInfo = {
      canceledAt: normalizedSubscription.canceledAt,
      cancelAtPeriodEnd: normalizedSubscription.cancelAtPeriodEnd,
      cancelReason: null,
      refundAmount: null,
      refundStatus: null
    };
    
    // 現在のサブスクリプション状態を判定
    const hasActiveSubscription = normalizedSubscription.status === 'active' || normalizedTrial.isActive;
    const canAccessPremiumFeatures = data.isPremium || hasActiveSubscription;
    const subscriptionExpiresAt = normalizedSubscription.currentPeriodEnd || normalizedTrial.endDate;
    
    let daysUntilExpiry: number | null = null;
    if (subscriptionExpiresAt) {
      const now = new Date();
      const expiryDate = subscriptionExpiresAt.toDate();
      daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    return {
      uid: userId,
      email: data.email || '',
      createdAt: data.createdAt || Timestamp.now(),
      
      // 新しいサブスクリプション情報
      subscriptionBasic: defaultSubscriptionBasic,
      subscriptionManagement: null,
      subscriptionSchedule: null,
      cancellation: defaultCancellation,
      
      // 後方互換性のため既存フィールドも保持
      trial: normalizedTrial,
      subscription: normalizedSubscription,
      billing: data.billing || defaultBilling,
      isPremium: data.isPremium || false,
      
      // 新しい便利フィールド
      hasActiveSubscription,
      canAccessPremiumFeatures,
      subscriptionExpiresAt,
      daysUntilExpiry
    };
  } catch (error: any) {
    // 権限エラーの場合は静かに処理（新規ユーザーの場合に発生）
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions')) {
      // Expected for new users - return null without logging
      return null;
    }
    // その他のエラーも静かに処理
    return null;
  }
}

/**
 * トライアル期限をチェックして更新
 */
export async function checkAndUpdateTrialStatus(userId: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      return;
    }
    const userData = await getUserSubscriptionData(userId);
    
    if (!userData || !userData.trial.isActive) {
      return;
    }
    
    const now = new Date();
    const endDate = userData.trial.endDate?.toDate();
    
    if (endDate && endDate < now) {
      // トライアル期限切れ
      const userRef = doc(db, 'users', userId);
      
      // スクリプトで設定された有料会員（subscriptionStatusがactive）の場合はisPremiumを保持
      const updates: any = {
        'trial.isActive': false,
        updatedAt: serverTimestamp()
      };
      
      // subscriptionStatusがactiveでない場合のみisPremiumをfalseに
      const userDoc = await getDoc(userRef);
      const currentData = userDoc.data();
      if (currentData?.subscriptionStatus !== 'active') {
        updates['isPremium'] = false;
      }
      
      await updateDoc(userRef, updates);
    }
  } catch (error: any) {
    // 権限エラーの場合は静かに処理
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions')) {
      // Expected for new users - ignore
      return;
    }
    // その他のエラーも静かに処理
    return;
  }
}

/**
 * 支払い履歴を作成
 */
export async function createPaymentRecord(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<string> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const paymentsRef = collection(db, 'payments');
    const newDocRef = doc(paymentsRef);
    await setDoc(newDocRef, {
      ...payment,
      createdAt: serverTimestamp()
    });
    
    return newDocRef.id;
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
}

/**
 * ユーザーの支払い履歴を取得
 */
export async function getUserPayments(userId: string): Promise<Payment[]> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      return [];
    }
    const paymentsRef = collection(db, 'payments');
    const q = query(
      paymentsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Payment));
  } catch (error) {
    console.error('Error getting user payments:', error);
    return [];
  }
}

/**
 * サブスクリプションを有料プランに更新
 */
export async function upgradeToPremium(
  userId: string,
  subscriptionData: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: Date;
  }
): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const userRef = doc(db, 'users', userId);
    
    // サブスクリプション情報を更新
    await updateDoc(userRef, {
      'subscription.status': 'active',
      'subscription.currentPeriodStart': Timestamp.now(),
      'subscription.currentPeriodEnd': Timestamp.fromDate(subscriptionData.currentPeriodEnd),
      'subscription.cancelAtPeriodEnd': false,
      'billing.customerId': subscriptionData.stripeCustomerId,
      'billing.nextBillingDate': Timestamp.fromDate(subscriptionData.currentPeriodEnd),
      'trial.isActive': false, // トライアルを終了
      'isPremium': true,
      updatedAt: serverTimestamp()
    });
    
    // サブスクリプション履歴を作成
    const subscriptionsRef = collection(db, 'subscriptions');
    await setDoc(doc(subscriptionsRef), {
      userId,
      status: 'active',
      planId: 'monthly',
      amount: 1980,
      currency: 'JPY',
      startDate: Timestamp.now(),
      endDate: null,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`User ${userId} upgraded to premium`);
  } catch (error) {
    console.error('Error upgrading to premium:', error);
    throw error;
  }
}

/**
 * サブスクリプションをキャンセル
 */
export async function cancelSubscription(userId: string, reason?: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const userData = await getUserSubscriptionData(userId);
    
    if (!userData || userData.subscription.status !== 'active') {
      throw new Error('No active subscription found');
    }
    
    const userRef = doc(db, 'users', userId);
    
    // 期間終了時に解約するようマーク
    await updateDoc(userRef, {
      'subscription.cancelAtPeriodEnd': true,
      'subscription.canceledAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // サブスクリプション履歴を更新
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(
      subscriptionsRef,
      where('userId', '==', userId),
      where('status', '==', 'active'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const subDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'subscriptions', subDoc.id), {
        canceledAt: serverTimestamp(),
        cancelReason: reason,
        updatedAt: serverTimestamp()
      });
    }
    
    console.log(`Subscription canceled for user ${userId}`);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * 解約をキャンセル（再開）
 */
export async function reactivateSubscription(userId: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'subscription.cancelAtPeriodEnd': false,
      'subscription.canceledAt': null,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Subscription reactivated for user ${userId}`);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
}