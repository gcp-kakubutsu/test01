import { Timestamp } from 'firebase/firestore';
import {
  UserWithSubscription,
  UserSubscriptionStatus,
  TrialInfo,
  SubscriptionInfo
} from '@/types/subscription';

/**
 * ユーザーのサブスクリプションステータスを判定
 */
export function getUserStatus(user: UserWithSubscription): UserSubscriptionStatus {
  const now = new Date();
  
  // 有料会員チェック（スクリプトで設定されたisPremiumフィールドも確認）
  if (user.isPremium || user.subscription?.status === 'active') {
    // スクリプトで設定された場合、subscriptionStatusフィールドもチェック
    if (user.subscription?.cancelAtPeriodEnd) {
      return UserSubscriptionStatus.PREMIUM_CANCELED;
    }
    return UserSubscriptionStatus.PREMIUM_ACTIVE;
  }
  
  // トライアルチェック
  if (user.trial?.isActive && user.trial.endDate) {
    if (user.trial.endDate.toDate() > now) {
      return UserSubscriptionStatus.TRIAL_ACTIVE;
    }
    return UserSubscriptionStatus.TRIAL_EXPIRED;
  }
  
  return UserSubscriptionStatus.FREE;
}

/**
 * プレミアム機能へのアクセス権限をチェック
 */
export function hasPremiumAccess(user: UserWithSubscription): boolean {
  const status = getUserStatus(user);
  return status === UserSubscriptionStatus.TRIAL_ACTIVE || 
         status === UserSubscriptionStatus.PREMIUM_ACTIVE ||
         status === UserSubscriptionStatus.PREMIUM_CANCELED;
}

/**
 * トライアル情報を取得
 */
export function getTrialInfo(user: UserWithSubscription): TrialInfo {
  if (!user.trial?.isActive || !user.trial.endDate) {
    return {
      isActive: false,
      daysUsed: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      expiresAt: null,
      message: user.trial?.hasUsed ? 'トライアル期間は終了しました' : 'トライアル未使用'
    };
  }
  
  const now = new Date();
  const endDate = user.trial.endDate.toDate();
  const startDate = user.trial.startDate?.toDate() || now;
  
  const usedMs = now.getTime() - startDate.getTime();
  const remainingMs = endDate.getTime() - now.getTime();
  
  // 期限切れチェック
  if (remainingMs <= 0) {
    return {
      isActive: false,
      daysUsed: 7,
      daysRemaining: 0,
      hoursRemaining: 0,
      expiresAt: endDate,
      message: 'トライアル期間が終了しました'
    };
  }
  
  const daysUsed = Math.floor(usedMs / (1000 * 60 * 60 * 24)) + 1;
  const daysRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  
  let message = '';
  if (daysRemaining > 1) {
    message = `プレミアム機能をあと${daysRemaining}日間無料でお試しいただけます`;
  } else if (hoursRemaining > 24) {
    message = `プレミアム機能をあと${daysRemaining + 1}日間無料でお試しいただけます`;
  } else if (hoursRemaining > 0) {
    message = `⚠️ トライアル終了まであと${hoursRemaining}時間です`;
  } else {
    message = 'トライアル期間が終了しました';
  }
  
  return {
    isActive: remainingMs > 0,
    daysUsed,
    daysRemaining,
    hoursRemaining,
    expiresAt: endDate,
    message
  };
}

/**
 * サブスクリプション情報を取得
 */
export function getSubscriptionInfo(user: UserWithSubscription): SubscriptionInfo {
  // スクリプトで設定されたプレミアムユーザーもチェック
  const isPremiumUser = user.isPremium || user.subscription?.status === 'active';
  
  if (!isPremiumUser) {
    return {
      isActive: false,
      willRenew: false,
      daysRemaining: 0,
      nextBillingDate: null,
      cancelationDate: null,
      amount: 0,
      message: '有料プランに未加入'
    };
  }
  
  const now = new Date();
  const periodEnd = user.subscription?.currentPeriodEnd?.toDate();
  
  // スクリプトで設定されたプレミアムユーザーで期間が設定されていない場合
  if (!periodEnd && user.isPremium) {
    return {
      isActive: true,
      willRenew: false,
      daysRemaining: 999, // 無制限として扱う
      nextBillingDate: null,
      cancelationDate: null,
      amount: 0,
      message: 'プレミアム会員'
    };
  }
  
  if (!periodEnd) {
    return {
      isActive: false,
      willRenew: false,
      daysRemaining: 0,
      nextBillingDate: null,
      cancelationDate: null,
      amount: 0,
      message: 'エラー: 請求期間が設定されていません'
    };
  }
  
  const remainingMs = periodEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  
  let message = '';
  if (user.subscription?.cancelAtPeriodEnd) {
    message = `${periodEnd.toLocaleDateString('ja-JP')}に解約予定`;
  } else {
    message = `次回更新日: ${periodEnd.toLocaleDateString('ja-JP')}`;
  }
  
  return {
    isActive: true,
    willRenew: !user.subscription?.cancelAtPeriodEnd,
    daysRemaining,
    nextBillingDate: user.subscription?.cancelAtPeriodEnd ? null : periodEnd,
    cancelationDate: user.subscription?.cancelAtPeriodEnd ? periodEnd : null,
    amount: 1980, // 月額料金
    message
  };
}

/**
 * 新規ユーザー用のトライアルデータを作成
 */
export function createTrialData(): {
  trial: {
    startDate: Timestamp;
    endDate: Timestamp;
    isActive: boolean;
    hasUsed: boolean;
    source: string;
  };
  isPremium: boolean;
} {
  const now = new Date();
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後
  
  return {
    trial: {
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      isActive: true,
      hasUsed: true,
      source: 'campaign_2025'
    },
    isPremium: true // トライアル中はプレミアム機能を使える
  };
}

/**
 * デフォルトのサブスクリプションデータを作成
 */
export function createDefaultSubscriptionData(): {
  subscription: {
    status: 'none';
    currentPeriodStart: null;
    currentPeriodEnd: null;
    cancelAtPeriodEnd: boolean;
    canceledAt: null;
    pausedAt: null;
  };
  billing: {
    customerId: null;
    paymentMethodId: null;
    lastPaymentDate: null;
    nextBillingDate: null;
  };
} {
  return {
    subscription: {
      status: 'none',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      pausedAt: null
    },
    billing: {
      customerId: null,
      paymentMethodId: null,
      lastPaymentDate: null,
      nextBillingDate: null
    }
  };
}