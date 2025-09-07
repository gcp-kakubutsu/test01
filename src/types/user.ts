import { Timestamp } from 'firebase/firestore';

/**
 * ユーザーの基本情報型
 */
export interface User {
  uid: string;
  email: string | null;
  username?: string | null;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  interests?: string[];
  isGirl?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Payment UID関連フィールド
  /**
   * 決済用の16桁英数字UID
   * 決済会社のsendidとして使用される
   */
  payment_uid: string;
  
  /**
   * payment_uidが作成された日時
   */
  payment_uid_created_at: Timestamp;
  
  /**
   * payment_uidが最後に更新された日時
   */
  payment_uid_updated_at: Timestamp;
}

/**
 * payment_uid関連の情報のみを含む型
 */
export interface PaymentUidInfo {
  /**
   * 決済用の16桁英数字UID
   * 形式: [A-Za-z0-9]{16}
   */
  payment_uid: string;
  
  /**
   * payment_uidが作成された日時
   */
  payment_uid_created_at: Timestamp;
  
  /**
   * payment_uidが最後に更新された日時
   */
  payment_uid_updated_at: Timestamp;
}

/**
 * 決済関連の基本情報型
 */
export interface PaymentInfo {
  /**
   * 決済用UID
   */
  payment_uid: string;
  
  /**
   * ユーザーID
   */
  user_id: string;
  
  /**
   * 決済ステータス
   */
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  
  /**
   * 最後の決済日時
   */
  last_payment_at?: Timestamp | null;
  
  /**
   * 次の決済予定日時
   */
  next_payment_at?: Timestamp | null;
  
  /**
   * 累計決済金額
   */
  total_amount?: number;
  
  /**
   * 決済方法
   */
  payment_method?: 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'other';
  
  /**
   * 決済情報の作成日時
   */
  created_at: Timestamp;
  
  /**
   * 決済情報の更新日時
   */
  updated_at: Timestamp;
}

/**
 * 決済履歴の個別エントリー型
 */
export interface PaymentHistoryEntry {
  /**
   * 履歴エントリーのID
   */
  id: string;
  
  /**
   * 決済用UID
   */
  payment_uid: string;
  
  /**
   * ユーザーID
   */
  user_id: string;
  
  /**
   * 決済金額
   */
  amount: number;
  
  /**
   * 通貨
   */
  currency: 'JPY' | 'USD' | 'EUR';
  
  /**
   * 決済ステータス
   */
  status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded';
  
  /**
   * 決済方法
   */
  payment_method: 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'other';
  
  /**
   * 決済の説明
   */
  description?: string;
  
  /**
   * エラーメッセージ（失敗時）
   */
  error_message?: string;
  
  /**
   * 外部決済サービスのトランザクションID
   */
  transaction_id?: string;
  
  /**
   * 決済処理日時
   */
  processed_at: Timestamp;
  
  /**
   * 履歴エントリーの作成日時
   */
  created_at: Timestamp;
}

/**
 * 決済統計情報型
 */
export interface PaymentStats {
  /**
   * 決済用UID
   */
  payment_uid: string;
  
  /**
   * ユーザーID
   */
  user_id: string;
  
  /**
   * 総決済回数
   */
  total_payments: number;
  
  /**
   * 成功した決済回数
   */
  successful_payments: number;
  
  /**
   * 失敗した決済回数
   */
  failed_payments: number;
  
  /**
   * 累計決済金額
   */
  total_amount: number;
  
  /**
   * 平均決済金額
   */
  average_amount: number;
  
  /**
   * 最初の決済日時
   */
  first_payment_at?: Timestamp | null;
  
  /**
   * 最後の決済日時
   */
  last_payment_at?: Timestamp | null;
  
  /**
   * 最も頻繁に使用される決済方法
   */
  most_used_payment_method?: 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'other';
  
  /**
   * 統計情報の更新日時
   */
  updated_at: Timestamp;
}

/**
 * payment_uidを持つユーザーの検索結果型
 */
export interface UserWithPaymentUid extends User {
  payment_uid: string;
  payment_uid_created_at: Timestamp;
  payment_uid_updated_at: Timestamp;
}

/**
 * 決済関連の拡張ユーザー情報型
 */
export interface UserWithPaymentDetails extends User {
  /**
   * 決済基本情報
   */
  payment_info: PaymentInfo;
  
  /**
   * 決済履歴（最新のもの）
   */
  payment_history?: PaymentHistoryEntry[];
  
  /**
   * 決済統計
   */
  payment_stats: PaymentStats;
}

/**
 * payment_uid生成時の操作結果型
 */
export interface PaymentUidOperationResult {
  /**
   * 操作が成功したかどうか
   */
  success: boolean;
  
  /**
   * 対象のユーザーID
   */
  userId?: string;
  
  /**
   * 生成または取得されたpayment_uid
   */
  payment_uid?: string;
  
  /**
   * エラーメッセージ（失敗時）
   */
  error?: string;
  
  /**
   * 操作実行日時
   */
  timestamp: Date;
}

/**
 * 一括操作の結果型
 */
export interface BatchPaymentUidOperationResult {
  /**
   * 対象ユーザー総数
   */
  totalUsers: number;
  
  /**
   * 成功した処理数
   */
  successCount: number;
  
  /**
   * 失敗した処理数
   */
  failureCount: number;
  
  /**
   * エラー詳細のリスト
   */
  errors: Array<{
    userId: string;
    error: string;
  }>;
  
  /**
   * 処理にかかった時間（ミリ秒）
   */
  duration: number;
  
  /**
   * 操作実行日時
   */
  timestamp: Date;
}

// 型ガード関数

/**
 * オブジェクトがPaymentUidInfoを持つかどうかを判定
 */
export function hasPaymentUidInfo(obj: any): obj is PaymentUidInfo {
  return (
    obj &&
    typeof obj.payment_uid === 'string' &&
    obj.payment_uid_created_at instanceof Timestamp &&
    obj.payment_uid_updated_at instanceof Timestamp
  );
}

/**
 * ユーザーがpayment_uidを持つかどうかを判定
 */
export function hasPaymentUid(user: any): user is UserWithPaymentUid {
  return (
    user &&
    typeof user.payment_uid === 'string' &&
    user.payment_uid.length === 16 &&
    /^[A-Za-z0-9]{16}$/.test(user.payment_uid)
  );
}

/**
 * payment_uidの形式が正しいかを判定
 */
export function isValidPaymentUid(paymentUid: string): boolean {
  return typeof paymentUid === 'string' && 
         paymentUid.length === 16 && 
         /^[A-Za-z0-9]{16}$/.test(paymentUid);
}

// 定数定義

/**
 * payment_uid関連の定数
 */
export const PAYMENT_UID_CONSTANTS = {
  /**
   * payment_uidの長さ
   */
  LENGTH: 16,
  
  /**
   * payment_uidに使用可能な文字セット
   */
  CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  
  /**
   * payment_uid生成時の最大リトライ回数
   */
  MAX_RETRY_COUNT: 10,
  
  /**
   * payment_uidの正規表現パターン
   */
  REGEX_PATTERN: /^[A-Za-z0-9]{16}$/,
} as const;

/**
 * 決済ステータスの定数
 */
export const PAYMENT_STATUS = {
  ACTIVE: 'active' as const,
  INACTIVE: 'inactive' as const,
  PENDING: 'pending' as const,
  SUSPENDED: 'suspended' as const,
  SUCCEEDED: 'succeeded' as const,
  FAILED: 'failed' as const,
  CANCELED: 'canceled' as const,
  REFUNDED: 'refunded' as const,
} as const;

/**
 * 決済方法の定数
 */
export const PAYMENT_METHOD = {
  CREDIT_CARD: 'credit_card' as const,
  BANK_TRANSFER: 'bank_transfer' as const,
  DIGITAL_WALLET: 'digital_wallet' as const,
  OTHER: 'other' as const,
} as const;

/**
 * サポートする通貨の定数
 */
export const SUPPORTED_CURRENCY = {
  JPY: 'JPY' as const,
  USD: 'USD' as const,
  EUR: 'EUR' as const,
} as const;