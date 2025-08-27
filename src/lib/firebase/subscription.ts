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
  Subscription
} from '@/types/subscription';
import { createTrialData, createDefaultSubscriptionData } from '@/utils/subscription';

/**
 * 新規ユーザーのトライアルを初期化
 */
export async function initializeUserTrial(userId: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    
    // すでにトライアルを使用済みの場合はスキップ
    if (userData.trial?.hasUsed) {
      console.log('User has already used trial');
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
    
    console.log(`Trial initialized for user ${userId}`);
  } catch (error) {
    console.error('Error initializing trial:', error);
    throw error;
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
    
    const defaultSubscription: SubscriptionData = {
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
    
    return {
      uid: userId,
      email: data.email || '',
      createdAt: data.createdAt || Timestamp.now(),
      trial: data.trial || defaultTrial,
      subscription: data.subscription || defaultSubscription,
      billing: data.billing || defaultBilling,
      isPremium: data.isPremium || false
    };
  } catch (error) {
    console.error('Error getting user subscription data:', error);
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
      
      console.log(`Trial expired for user ${userId}`);
    }
  } catch (error) {
    console.error('Error checking trial status:', error);
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