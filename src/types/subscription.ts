import { Timestamp } from 'firebase/firestore';

// プラン種別
export type PlanType = 'free' | '1month' | '3month' | '6month' | '12month';

// サブスクリプションステータス
export type SubscriptionStatus = 
  | 'active'           // アクティブ
  | 'canceled'         // キャンセル済み
  | 'past_due'         // 支払い延滞
  | 'trialing'         // トライアル中
  | 'paused'           // 一時停止
  | 'expired'          // 期限切れ
  | 'none';            // サブスクリプションなし

// 請求サイクル
export type BillingCycle = 
  | 'monthly'          // 月次
  | 'quarterly'        // 3ヶ月
  | 'semiannual'       // 6ヶ月
  | 'annual'           // 年次
  | 'one_time';        // 一回払い

// 決済ステータス
export type PaymentStatus = 
  | 'pending'          // 処理中
  | 'succeeded'        // 成功
  | 'failed'           // 失敗
  | 'canceled'         // キャンセル
  | 'refunded'         // 返金
  | 'partially_refunded'; // 部分返金

// ユーザーのサブスクリプションステータス（後方互換性のため保持）
export enum UserSubscriptionStatus {
  TRIAL_ACTIVE = 'trial_active',           // トライアル期間中
  TRIAL_EXPIRED = 'trial_expired',         // トライアル期限切れ
  PREMIUM_ACTIVE = 'premium_active',       // 有料会員（アクティブ）
  PREMIUM_CANCELED = 'premium_canceled',   // 有料会員（解約予定）
  FREE = 'free'                           // 無料会員
}

// トライアル情報
export interface TrialData {
  startDate: Timestamp | null;      // トライアル開始日時
  endDate: Timestamp | null;        // トライアル終了日時
  isActive: boolean;                // トライアル有効フラグ
  hasUsed: boolean;                 // トライアル使用済みフラグ
  source?: 'campaign_2025' | string; // トライアル取得元
}

// サブスクリプション情報
export interface SubscriptionData {
  // Stripe互換の 'trialing' に加え、Firestoreに 'trial' が保存されるケースも許容
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'trial' | 'none';
  currentPeriodStart: Timestamp | null;  // 現在の請求期間開始日
  currentPeriodEnd: Timestamp | null;    // 現在の請求期間終了日
  cancelAtPeriodEnd: boolean;           // 期間終了時に解約するか
  canceledAt: Timestamp | null;          // 解約日時
  pausedAt: Timestamp | null;           // 一時停止日時
}

// 請求情報
export interface BillingData {
  customerId: string | null;        // Stripe Customer ID
  paymentMethodId: string | null;   // デフォルト支払い方法
  lastPaymentDate: Timestamp | null;
  nextBillingDate: Timestamp | null;
}

// サブスクリプション基本情報
export interface SubscriptionBasicInfo {
  planType: PlanType;
  status: SubscriptionStatus;
  startDate: Timestamp;
  endDate: Timestamp | null;
  autoRenew: boolean;
  trialEndDate: Timestamp | null;
}

// サブスクリプション管理情報
export interface SubscriptionManagementInfo {
  subscriptionId: string;
  customerId: string;
  priceId: string;
  billingCycle: BillingCycle;
  nextBillingDate: Timestamp | null;
  lastBillingDate: Timestamp | null;
  amount: number;
  currency: 'JPY';
}

// キャンセル情報
export interface CancellationInfo {
  canceledAt: Timestamp | null;
  cancelAtPeriodEnd: boolean;
  cancelReason: string | null;
  refundAmount: number | null;
  refundStatus: 'none' | 'pending' | 'completed' | 'failed' | null;
}

// サブスクリプションスケジュール
export interface SubscriptionSchedule {
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  nextPeriodStart: Timestamp | null;
  gracePeriodEnd: Timestamp | null;
  pausedAt: Timestamp | null;
  resumeAt: Timestamp | null;
}

// プラン情報
export interface PlanInfo {
  id: string;
  name: string;
  description: string;
  planType: PlanType;
  amount: number;
  currency: 'JPY';
  billingCycle: BillingCycle;
  trialDays: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 決済イベント
export interface PaymentEvent {
  id: string;
  userId: string;
  subscriptionId: string | null;
  eventType: 'payment.succeeded' | 'payment.failed' | 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | 'refund.created';
  amount: number;
  currency: 'JPY';
  status: PaymentStatus;
  paymentMethodId: string | null;
  failureReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: Timestamp;
}

// サブスクリプションデフォルト値
export interface SubscriptionDefaults {
  freePlanFeatures: string[];
  trialDays: number;
  gracePeriodDays: number;
  defaultCurrency: 'JPY';
  supportedPaymentMethods: string[];
  minimumAmount: number;
  maximumAmount: number;
}

// ユーザー拡張型（既存のUserTypeに追加）
export interface UserWithSubscription {
  uid: string;
  email: string;
  createdAt: Timestamp;
  
  // サブスクリプション関連情報
  subscriptionBasic: SubscriptionBasicInfo;
  subscriptionManagement: SubscriptionManagementInfo | null;
  subscriptionSchedule: SubscriptionSchedule | null;
  cancellation: CancellationInfo;
  
  // 後方互換性のため既存フィールドも保持
  trial: TrialData;
  subscription: SubscriptionData;
  billing: BillingData;
  isPremium: boolean;  // プレミアム機能へのアクセス権
  
  // 新しい便利フィールド
  hasActiveSubscription: boolean;
  canAccessPremiumFeatures: boolean;
  subscriptionExpiresAt: Timestamp | null;
  daysUntilExpiry: number | null;
}

// トライアル情報の詳細
export interface TrialInfo {
  isActive: boolean;
  daysUsed: number;
  daysRemaining: number;
  hoursRemaining: number;
  expiresAt: Date | null;
  message: string;
}

// サブスクリプション情報の詳細
export interface SubscriptionInfo {
  isActive: boolean;
  willRenew: boolean;
  daysRemaining: number;
  nextBillingDate: Date | null;
  cancelationDate: Date | null;
  amount: number;
  message: string;
}

// 支払い履歴（更新版）
export interface Payment {
  id: string;
  userId: string;
  subscriptionId: string | null;
  planId: string | null;
  
  // 金額情報
  amount: number;
  currency: 'JPY';
  taxAmount: number | null;
  discountAmount: number | null;
  netAmount: number;
  
  // 決済情報
  status: PaymentStatus;
  paymentMethod: 'card' | 'bank_transfer' | 'digital_wallet' | 'other';
  paymentMethodDetails: Record<string, any> | null;
  
  // 外部サービス連携
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  transactionId: string | null;
  
  // エラー・返金情報
  failureReason: string | null;
  failureCode: string | null;
  refundedAmount: number | null;
  refundReason: string | null;
  
  // メタデータ
  description: string | null;
  invoiceId: string | null;
  receiptUrl: string | null;
  metadata: Record<string, any> | null;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// サブスクリプション履歴（更新版）
export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  planType: PlanType;
  planId: string;
  amount: number;
  currency: 'JPY';
  billingCycle: BillingCycle;
  startDate: Timestamp;
  endDate: Timestamp | null;
  trialStart: Timestamp | null;
  trialEnd: Timestamp | null;
  canceledAt: Timestamp | null;
  cancelReason: string | null;
  
  // 外部サービス連携
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  
  // 管理情報
  autoRenew: boolean;
  pausedAt: Timestamp | null;
  pauseReason: string | null;
  metadata: Record<string, any> | null;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// トライアルキャンペーン
export interface TrialCampaign {
  id: string;
  name: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp | null;
  trialDays: number;
  targetPlanTypes: PlanType[];
  discountPercent: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  eligibilityRules: Record<string, any> | null;
  metadata: Record<string, any> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 定数定義
export const SUBSCRIPTION_CONSTANTS = {
  PLAN_TYPES: {
    FREE: 'free' as const,
    ONE_MONTH: '1month' as const,
    THREE_MONTH: '3month' as const,
    SIX_MONTH: '6month' as const,
    TWELVE_MONTH: '12month' as const,
  },
  
  BILLING_CYCLES: {
    MONTHLY: 'monthly' as const,
    QUARTERLY: 'quarterly' as const,
    SEMIANNUAL: 'semiannual' as const,
    ANNUAL: 'annual' as const,
    ONE_TIME: 'one_time' as const,
  },
  
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active' as const,
    CANCELED: 'canceled' as const,
    PAST_DUE: 'past_due' as const,
    TRIALING: 'trialing' as const,
    PAUSED: 'paused' as const,
    EXPIRED: 'expired' as const,
    NONE: 'none' as const,
  },
  
  PAYMENT_STATUS: {
    PENDING: 'pending' as const,
    SUCCEEDED: 'succeeded' as const,
    FAILED: 'failed' as const,
    CANCELED: 'canceled' as const,
    REFUNDED: 'refunded' as const,
    PARTIALLY_REFUNDED: 'partially_refunded' as const,
  },
  
  CURRENCY: {
    JPY: 'JPY' as const,
  },
  
  DEFAULT_VALUES: {
    TRIAL_DAYS: 7,
    GRACE_PERIOD_DAYS: 3,
    CURRENCY: 'JPY' as const,
    MIN_AMOUNT: 100,
    MAX_AMOUNT: 100000,
  }
} as const;

// 型ガード関数
export const isValidPlanType = (value: string): value is PlanType => {
  return Object.values(SUBSCRIPTION_CONSTANTS.PLAN_TYPES).includes(value as PlanType);
};

export const isValidSubscriptionStatus = (value: string): value is SubscriptionStatus => {
  return Object.values(SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS).includes(value as SubscriptionStatus);
};

export const isValidPaymentStatus = (value: string): value is PaymentStatus => {
  return Object.values(SUBSCRIPTION_CONSTANTS.PAYMENT_STATUS).includes(value as PaymentStatus);
};

export const isValidBillingCycle = (value: string): value is BillingCycle => {
  return Object.values(SUBSCRIPTION_CONSTANTS.BILLING_CYCLES).includes(value as BillingCycle);
};