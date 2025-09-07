import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

// 文字セット: 英大文字・小文字・数字 (62文字)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYMENT_UID_LENGTH = 16;
const MAX_RETRIES = 10;

/**
 * 16桁のランダムなpayment_uidを生成する
 * @returns 16桁の英数字文字列
 */
export function generatePaymentUid(): string {
  let result = '';
  
  for (let i = 0; i < PAYMENT_UID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[randomIndex];
  }
  
  // バリデーション: 正確に16桁であることを確認
  if (result.length !== PAYMENT_UID_LENGTH) {
    throw new Error(`Generated payment_uid has invalid length: ${result.length}`);
  }
  
  // バリデーション: 有効な文字のみが含まれていることを確認
  if (!/^[A-Za-z0-9]+$/.test(result)) {
    throw new Error(`Generated payment_uid contains invalid characters: ${result}`);
  }
  
  return result;
}

/**
 * payment_uidがFirestore上でユニークかどうかをチェックする
 * @param paymentUid チェックするpayment_uid
 * @returns ユニークな場合true、重複している場合false
 */
export async function checkPaymentUidUnique(paymentUid: string): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // バリデーション: payment_uidの形式チェック
    if (!paymentUid || paymentUid.length !== PAYMENT_UID_LENGTH) {
      throw new Error(`Invalid payment_uid format: ${paymentUid}`);
    }
    
    if (!/^[A-Za-z0-9]+$/.test(paymentUid)) {
      throw new Error(`Invalid payment_uid characters: ${paymentUid}`);
    }
    
    console.log(`🔍 Checking uniqueness of payment_uid: ${paymentUid}`);
    
    // usersコレクションでpayment_uidの重複チェック
    const usersQuery = query(
      collection(db, 'users'),
      where('payment_uid', '==', paymentUid),
      limit(1)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const isUnique = querySnapshot.empty;
    
    console.log(`✅ payment_uid ${paymentUid} uniqueness check result: ${isUnique ? 'unique' : 'duplicate'}`);
    
    return isUnique;
  } catch (error) {
    console.error('❌ Error checking payment_uid uniqueness:', error);
    throw new Error(`Failed to check payment_uid uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * ユニークなpayment_uidを生成する（リトライ機能付き）
 * @param maxRetries 最大リトライ回数（デフォルト: 10）
 * @returns ユニークなpayment_uid
 */
export async function generateUniquePaymentUid(maxRetries: number = MAX_RETRIES): Promise<string> {
  console.log(`🔄 Starting unique payment_uid generation (max retries: ${maxRetries})`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎯 Generation attempt ${attempt}/${maxRetries}`);
      
      // payment_uidを生成
      const paymentUid = generatePaymentUid();
      console.log(`📝 Generated payment_uid: ${paymentUid}`);
      
      // ユニーク性をチェック
      const isUnique = await checkPaymentUidUnique(paymentUid);
      
      if (isUnique) {
        console.log(`✅ Successfully generated unique payment_uid: ${paymentUid} (attempt ${attempt})`);
        return paymentUid;
      }
      
      console.warn(`⚠️ payment_uid ${paymentUid} is not unique, retrying... (attempt ${attempt}/${maxRetries})`);
      
      // 短時間待機してからリトライ（高負荷を避ける）
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
      
    } catch (error) {
      console.error(`❌ Error in attempt ${attempt}:`, error);
      
      // 最後のリトライの場合はエラーを投げる
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate unique payment_uid after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // 短時間待機してからリトライ
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  
  // ここに到達することはないが、TypeScriptの型チェック用
  throw new Error(`Failed to generate unique payment_uid after ${maxRetries} attempts`);
}

/**
 * payment_uidの形式が正しいかバリデーションする
 * @param paymentUid 検証するpayment_uid
 * @returns 正しい形式の場合true
 */
export function validatePaymentUidFormat(paymentUid: string): boolean {
  if (!paymentUid) return false;
  if (paymentUid.length !== PAYMENT_UID_LENGTH) return false;
  if (!/^[A-Za-z0-9]+$/.test(paymentUid)) return false;
  return true;
}

/**
 * payment_uid生成の統計情報
 */
export interface PaymentUidGenerationStats {
  totalAttempts: number;
  successfulGeneration: boolean;
  finalPaymentUid?: string;
  errors: string[];
  duration: number;
}

/**
 * 統計情報付きでユニークなpayment_uidを生成する
 * @param maxRetries 最大リトライ回数
 * @returns 統計情報
 */
export async function generateUniquePaymentUidWithStats(maxRetries: number = MAX_RETRIES): Promise<PaymentUidGenerationStats> {
  const startTime = Date.now();
  const stats: PaymentUidGenerationStats = {
    totalAttempts: 0,
    successfulGeneration: false,
    errors: [],
    duration: 0
  };
  
  try {
    const paymentUid = await generateUniquePaymentUid(maxRetries);
    stats.successfulGeneration = true;
    stats.finalPaymentUid = paymentUid;
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  stats.duration = Date.now() - startTime;
  return stats;
}