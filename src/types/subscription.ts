import { Timestamp } from 'firebase/firestore';

// ユーザーのサブスクリプションステータス
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
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
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

// ユーザー拡張型（既存のUserTypeに追加）
export interface UserWithSubscription {
  uid: string;
  email: string;
  createdAt: Timestamp;
  trial: TrialData;
  subscription: SubscriptionData;
  billing: BillingData;
  isPremium: boolean;  // プレミアム機能へのアクセス権
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

// 支払い履歴
export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: 'JPY';
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  paymentMethod: 'card' | 'bank_transfer';
  stripePaymentIntentId?: string;
  failureReason?: string | null;
  refundedAmount?: number | null;
  createdAt: Timestamp;
}

// サブスクリプション履歴
export interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'canceled' | 'expired';
  planId: 'monthly' | 'yearly';
  amount: number;
  currency: 'JPY';
  startDate: Timestamp;
  endDate: Timestamp | null;
  canceledAt: Timestamp | null;
  cancelReason?: string | null;
  stripeSubscriptionId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// トライアルキャンペーン
export interface TrialCampaign {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp | null;
  trialDays: number;
  isActive: boolean;
  description: string;
  createdAt: Timestamp;
}