# Payment UID 対応仕様書（フロントエンド）

## 📋 概要

Firebaseのuid（28桁）を決済会社のsendid（16桁）として使用できない問題の対応として、Firebase側でusersにpayment_uid（16桁）を新たに作成する仕様書です。

### 背景
- **問題**: Firebaseのuid（28桁）を決済会社のsendid（16桁）として使用できない
- **対応**: Firebase側でusersにpayment_uid（16桁）を新たに作成
- **対象**: Nukuneサービスのみ（Nukipediaは別仕様）

## 🎯 実装方針

### 1. Firebase側での対応
- 既存ユーザーと新規ユーザーにpayment_uid（16桁）を追加
- 決済関連処理ではpayment_uidを使用
- 既存のuidはそのまま保持（決済以外の用途で使用）

### 2. 段階的実装
- **Phase 1**: Firebase側でのpayment_uid生成・管理機能の実装
- **Phase 2**: 既存ユーザーへのpayment_uid追加
- **Phase 3**: フロントエンド側でのpayment_uid使用
- **Phase 4**: テスト・検証

## 🔧 Firebase側での実装

### 1. payment_uid生成機能

#### 16桁の英数字生成関数
```javascript
// utils/paymentUidGenerator.js

/**
 * 16桁の英数字payment_uidを生成
 * @returns {string} 16桁の英数字文字列
 */
export const generatePaymentUid = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * payment_uidの重複チェック
 * @param {string} paymentUid - チェックするpayment_uid
 * @returns {Promise<boolean>} 重複していない場合true
 */
export const checkPaymentUidUnique = async (paymentUid) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('payment_uid', '==', paymentUid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.empty;
  } catch (error) {
    console.error('payment_uid重複チェックエラー:', error);
    return false;
  }
};

/**
 * ユニークなpayment_uidを生成
 * @returns {Promise<string>} ユニークな16桁のpayment_uid
 */
export const generateUniquePaymentUid = async () => {
  let paymentUid;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    paymentUid = generatePaymentUid();
    isUnique = await checkPaymentUidUnique(paymentUid);
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('ユニークなpayment_uidの生成に失敗しました');
  }
  
  return paymentUid;
};
```

### 2. ユーザー管理機能の更新

#### 新規ユーザー作成時のpayment_uid追加
```javascript
// services/userService.js

import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateUniquePaymentUid } from '@/utils/paymentUidGenerator';

/**
 * 新規ユーザーを作成（payment_uid付き）
 * @param {string} uid - Firebase UID
 * @param {object} userData - ユーザーデータ
 * @returns {Promise<object>} 作成されたユーザーデータ
 */
export const createUserWithPaymentUid = async (uid, userData) => {
  try {
    // ユニークなpayment_uidを生成
    const paymentUid = await generateUniquePaymentUid();
    
    // ユーザーデータにpayment_uidを追加
    const userDataWithPaymentUid = {
      ...userData,
      payment_uid: paymentUid,
      payment_uid_created_at: new Date(),
      payment_uid_updated_at: new Date()
    };
    
    // Firestoreに保存
    await setDoc(doc(db, 'users', uid), userDataWithPaymentUid);
    
    console.log(`✅ ユーザー ${uid} にpayment_uid ${paymentUid} を追加しました`);
    
    return userDataWithPaymentUid;
    
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    throw error;
  }
};

/**
 * 既存ユーザーにpayment_uidを追加
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} 追加されたpayment_uid
 */
export const addPaymentUidToExistingUser = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`ユーザー ${uid} が見つかりません`);
    }
    
    const userData = userDoc.data();
    
    // 既にpayment_uidが存在するかチェック
    if (userData.payment_uid) {
      console.log(`⚠️ ユーザー ${uid} は既にpayment_uidを持っています: ${userData.payment_uid}`);
      return userData.payment_uid;
    }
    
    // ユニークなpayment_uidを生成
    const paymentUid = await generateUniquePaymentUid();
    
    // payment_uidを追加
    await updateDoc(userRef, {
      payment_uid: paymentUid,
      payment_uid_created_at: new Date(),
      payment_uid_updated_at: new Date()
    });
    
    console.log(`✅ ユーザー ${uid} にpayment_uid ${paymentUid} を追加しました`);
    
    return paymentUid;
    
  } catch (error) {
    console.error('payment_uid追加エラー:', error);
    throw error;
  }
};

/**
 * payment_uidでユーザーを検索
 * @param {string} paymentUid - 決済用UID
 * @returns {Promise<object|null>} ユーザーデータ
 */
export const getUserByPaymentUid = async (paymentUid) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('payment_uid', '==', paymentUid));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    return {
      uid: userDoc.id,
      ...userDoc.data()
    };
    
  } catch (error) {
    console.error('payment_uid検索エラー:', error);
    throw error;
  }
};

/**
 * 全既存ユーザーにpayment_uidを追加（一括処理）
 * @returns {Promise<object>} 処理結果
 */
export const addPaymentUidToAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const results = {
      total: querySnapshot.size,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };
    
    console.log(`📊 ${results.total}件のユーザーを処理します`);
    
    for (const userDoc of querySnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // 既にpayment_uidが存在するかチェック
        if (userData.payment_uid) {
          results.skipped++;
          console.log(`⚠️ ユーザー ${userDoc.id} は既にpayment_uidを持っています`);
          continue;
        }
        
        // payment_uidを追加
        const paymentUid = await generateUniquePaymentUid();
        await updateDoc(userDoc.ref, {
          payment_uid: paymentUid,
          payment_uid_created_at: new Date(),
          payment_uid_updated_at: new Date()
        });
        
        results.processed++;
        console.log(`✅ ユーザー ${userDoc.id} にpayment_uid ${paymentUid} を追加しました`);
        
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          uid: userDoc.id,
          error: error.message
        });
        console.error(`❌ ユーザー ${userDoc.id} の処理でエラー:`, error);
      }
    }
    
    console.log('🎉 一括処理が完了しました:', results);
    return results;
    
  } catch (error) {
    console.error('一括処理エラー:', error);
    throw error;
  }
};
```

### 3. 型定義の更新

#### ユーザー型の更新
```typescript
// types/user.ts

import { Timestamp } from 'firebase/firestore';

// 既存のUser型を拡張
export interface User {
  // 既存フィールド
  uid: string;
  email: string;
  username: string;
  gender: "male" | "female";
  age: number | null;
  birthDate: string;
  bio: string;
  profilePhotoUrl: string;
  location: string;
  occupation: string;
  additionalPhotos: string[];
  kinks: any[];
  interests: any[];
  partnerAgeRange: object;
  hasCompletedPreferences: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastPreferencesUpdate: Timestamp;
  isGirl: boolean;
  
  // 新規追加フィールド
  payment_uid: string;  // 16桁の決済用UID
  payment_uid_created_at: Timestamp;
  payment_uid_updated_at: Timestamp;
  
  // サブスクリプション関連フィールド（既存）
  plan: "free" | "1month" | "3month" | "6month" | "12month";
  planValid: boolean;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: Timestamp | null;
  lastPaymentAt: Timestamp | null;
  totalPayments: number;
  currentPlanAmount: number;
  planDiscount: number;
  isPopularPlan: boolean;
  subscriptionStatus: "active" | "expired" | "payment_failed" | "cancelled" | "grace_period";
  nextBillingDate: Timestamp | null;
  failedPaymentCount: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryIntervalDays: number;
  isCancelled: boolean;
  cancelledAt: Timestamp | null;
  contractEndDate: Timestamp | null;
  willAutoDowngrade: boolean;
  originalPlanType: string;
  cancellationReason: string | null;
}

// payment_uid関連の型
export interface PaymentUidInfo {
  payment_uid: string;
  payment_uid_created_at: Timestamp;
  payment_uid_updated_at: Timestamp;
}

// 決済関連の型
export interface PaymentInfo {
  payment_uid: string;
  amount: number;
  status: "pending" | "succeeded" | "failed";
  created_at: Timestamp;
  provider: string;
}
```

### 4. フックの更新

#### ユーザー管理フック
```typescript
// hooks/useUser.ts

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types/user';
import { addPaymentUidToExistingUser } from '@/services/userService';

export const useUser = (uid: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      async (doc) => {
        if (doc.exists()) {
          const userData = doc.data() as User;
          
          // payment_uidが存在しない場合は追加
          if (!userData.payment_uid) {
            try {
              console.log(`payment_uidが存在しないため、ユーザー ${uid} に追加します`);
              await addPaymentUidToExistingUser(uid);
              // 再取得はonSnapshotが自動的に行う
            } catch (error) {
              console.error('payment_uid追加エラー:', error);
              setError('payment_uidの追加に失敗しました');
            }
          }
          
          setUser(userData);
        } else {
          setError('ユーザーが見つかりません');
        }
        setLoading(false);
      },
      (error) => {
        console.error('User hook error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // payment_uid関連のヘルパー関数
  const getPaymentUid = () => {
    return user?.payment_uid || null;
  };

  const hasPaymentUid = () => {
    return !!user?.payment_uid;
  };

  const getPaymentUidInfo = () => {
    if (!user?.payment_uid) return null;
    
    return {
      payment_uid: user.payment_uid,
      created_at: user.payment_uid_created_at,
      updated_at: user.payment_uid_updated_at
    };
  };

  return {
    user,
    loading,
    error,
    getPaymentUid,
    hasPaymentUid,
    getPaymentUidInfo
  };
};
```

#### 決済関連フック
```typescript
// hooks/usePayment.ts

import { useState, useEffect } from 'react';
import { PaymentInfo } from '@/types/user';
import { getUserByPaymentUid } from '@/services/userService';

export const usePayment = (paymentUid: string) => {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentUid) {
      setLoading(false);
      return;
    }

    const fetchPaymentInfo = async () => {
      try {
        setLoading(true);
        
        // バックエンドAPIから決済情報を取得
        const response = await fetch(`/api/v1/payments/${paymentUid}`);
        
        if (!response.ok) {
          throw new Error('決済情報の取得に失敗しました');
        }
        
        const data = await response.json();
        setPaymentInfo(data);
        
      } catch (error) {
        console.error('Payment hook error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentInfo();
  }, [paymentUid]);

  // 決済履歴の取得
  const getPaymentHistory = () => {
    return paymentInfo.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  // 最新の決済情報
  const getLatestPayment = () => {
    return paymentInfo.length > 0 ? paymentInfo[0] : null;
  };

  // 決済統計
  const getPaymentStats = () => {
    const succeeded = paymentInfo.filter(p => p.status === 'succeeded');
    const totalAmount = succeeded.reduce((sum, p) => sum + p.amount, 0);
    
    return {
      totalCount: paymentInfo.length,
      succeededCount: succeeded.length,
      failedCount: paymentInfo.length - succeeded.length,
      totalAmount
    };
  };

  return {
    paymentInfo,
    loading,
    error,
    getPaymentHistory,
    getLatestPayment,
    getPaymentStats
  };
};
```

### 5. コンポーネントの更新

#### ユーザー情報表示コンポーネント
```typescript
// components/UserProfile.tsx

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';

interface UserProfileProps {
  uid: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ uid }) => {
  const { user, loading, error, getPaymentUid, hasPaymentUid } = useUser(uid);
  const [copied, setCopied] = React.useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">
            エラーが発生しました: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            ユーザー情報が見つかりません
          </div>
        </CardContent>
      </Card>
    );
  }

  const paymentUid = getPaymentUid();

  const handleCopyPaymentUid = async () => {
    if (paymentUid) {
      try {
        await navigator.clipboard.writeText(paymentUid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('コピーエラー:', error);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー情報</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">ユーザー名</label>
          <p className="text-lg">{user.username}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">メールアドレス</label>
          <p className="text-lg">{user.email}</p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">Firebase UID</label>
          <p className="text-sm font-mono bg-gray-100 p-2 rounded">
            {user.uid}
          </p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">決済用UID</label>
          <div className="flex items-center gap-2">
            {hasPaymentUid() ? (
              <>
                <p className="text-sm font-mono bg-blue-100 p-2 rounded flex-1">
                  {paymentUid}
                </p>
                <button
                  onClick={handleCopyPaymentUid}
                  className="p-2 hover:bg-gray-100 rounded"
                  title="コピー"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </>
            ) : (
              <Badge variant="outline" className="text-yellow-600">
                生成中...
              </Badge>
            )}
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium text-gray-700">プラン</label>
          <Badge 
            variant={user.plan === 'free' ? 'outline' : 'default'}
            className={user.plan === 'free' ? 'text-gray-600' : 'text-green-600'}
          >
            {user.plan === 'free' ? '無料プラン' : `${user.plan}プラン`}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 決済履歴表示コンポーネント
```typescript
// components/PaymentHistory.tsx

import React from 'react';
import { usePayment } from '@/hooks/usePayment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, DollarSign } from 'lucide-react';

interface PaymentHistoryProps {
  paymentUid: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ paymentUid }) => {
  const { 
    paymentInfo, 
    loading, 
    error, 
    getPaymentHistory, 
    getLatestPayment, 
    getPaymentStats 
  } = usePayment(paymentUid);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">
            エラーが発生しました: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const paymentHistory = getPaymentHistory();
  const latestPayment = getLatestPayment();
  const stats = getPaymentStats();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-800">成功</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">失敗</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">処理中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          決済履歴
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 統計情報 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCount}</div>
            <div className="text-sm text-gray-600">総決済回数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.succeededCount}</div>
            <div className="text-sm text-gray-600">成功回数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              ¥{stats.totalAmount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">総決済金額</div>
          </div>
        </div>

        {/* 最新の決済 */}
        {latestPayment && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">最新の決済</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-600" />
                <span>¥{latestPayment.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(latestPayment.status)}
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {new Date(latestPayment.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 決済履歴一覧 */}
        {paymentHistory.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-medium">決済履歴</h3>
            {paymentHistory.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-gray-600" />
                  <div>
                    <div className="font-medium">¥{payment.amount.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(payment.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payment.status)}
                  <Badge variant="outline" className="text-xs">
                    {payment.provider}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            決済履歴がありません
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

## 🧪 テスト計画

### 1. 単体テスト

#### payment_uid生成機能のテスト
```javascript
// tests/utils/paymentUidGenerator.test.js

import { 
  generatePaymentUid, 
  checkPaymentUidUnique, 
  generateUniquePaymentUid 
} from '@/utils/paymentUidGenerator';

describe('PaymentUidGenerator', () => {
  test('generatePaymentUid should return 16 character string', () => {
    const paymentUid = generatePaymentUid();
    expect(paymentUid).toHaveLength(16);
    expect(paymentUid).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  test('generatePaymentUid should return different values', () => {
    const uid1 = generatePaymentUid();
    const uid2 = generatePaymentUid();
    expect(uid1).not.toBe(uid2);
  });

  test('checkPaymentUidUnique should return boolean', async () => {
    const result = await checkPaymentUidUnique('test123456789012');
    expect(typeof result).toBe('boolean');
  });

  test('generateUniquePaymentUid should return unique payment_uid', async () => {
    const paymentUid = await generateUniquePaymentUid();
    expect(paymentUid).toHaveLength(16);
    expect(paymentUid).toMatch(/^[A-Za-z0-9]{16}$/);
  });
});
```

#### ユーザーサービス機能のテスト
```javascript
// tests/services/userService.test.js

import { 
  createUserWithPaymentUid, 
  addPaymentUidToExistingUser,
  getUserByPaymentUid 
} from '@/services/userService';

describe('UserService', () => {
  test('createUserWithPaymentUid should create user with payment_uid', async () => {
    const uid = 'test-user-001';
    const userData = {
      email: 'test@example.com',
      username: 'testuser'
    };

    const result = await createUserWithPaymentUid(uid, userData);
    
    expect(result.payment_uid).toHaveLength(16);
    expect(result.payment_uid_created_at).toBeDefined();
    expect(result.payment_uid_updated_at).toBeDefined();
  });

  test('addPaymentUidToExistingUser should add payment_uid to existing user', async () => {
    const uid = 'existing-user-001';
    
    const paymentUid = await addPaymentUidToExistingUser(uid);
    
    expect(paymentUid).toHaveLength(16);
    expect(paymentUid).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  test('getUserByPaymentUid should return user data', async () => {
    const paymentUid = 'test123456789012';
    
    const user = await getUserByPaymentUid(paymentUid);
    
    if (user) {
      expect(user.payment_uid).toBe(paymentUid);
      expect(user.uid).toBeDefined();
    }
  });
});
```

### 2. 統合テスト

#### フック機能のテスト
```javascript
// tests/hooks/useUser.test.js

import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from '@/hooks/useUser';

describe('useUser', () => {
  test('should return user data with payment_uid', async () => {
    const uid = 'test-user-001';
    
    const { result } = renderHook(() => useUser(uid));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    if (result.current.user) {
      expect(result.current.user.payment_uid).toHaveLength(16);
      expect(result.current.hasPaymentUid()).toBe(true);
    }
  });

  test('should handle missing payment_uid', async () => {
    const uid = 'user-without-payment-uid';
    
    const { result } = renderHook(() => useUser(uid));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // payment_uidが自動的に追加されることを確認
    await waitFor(() => {
      expect(result.current.hasPaymentUid()).toBe(true);
    });
  });
});
```

## 📋 実装チェックリスト

### Phase 1: Firebase側でのpayment_uid生成・管理機能の実装（2-3日）
- [ ] payment_uid生成関数の実装
- [ ] ユーザーサービス機能の実装
- [ ] 型定義の更新
- [ ] フックの更新

### Phase 2: 既存ユーザーへのpayment_uid追加（1日）
- [ ] 一括処理スクリプトの実行
- [ ] 既存ユーザーデータの確認
- [ ] エラーハンドリングの実装

### Phase 3: フロントエンド側でのpayment_uid使用（2-3日）
- [ ] コンポーネントの更新
- [ ] 決済関連UIの実装
- [ ] エラーハンドリングの実装

### Phase 4: テスト・検証（1-2日）
- [ ] 単体テストの作成・実行
- [ ] 統合テストの作成・実行
- [ ] 本番環境での検証

## ⚠️ 注意事項

### 1. 既存データとの互換性
- 既存のuidはそのまま保持
- payment_uidは新規追加フィールド
- 段階的な移行を実施

### 2. エラーハンドリング
- payment_uid生成失敗時のエラーハンドリング
- 既存ユーザーへの追加時のエラーハンドリング
- 重複チェックの実装

### 3. パフォーマンス
- 大量ユーザーへの一括処理時のパフォーマンス考慮
- インデックスの追加による検索性能向上
- キャッシュ機能の実装

### 4. セキュリティ
- payment_uidの一意性確保
- 適切な権限管理
- データの整合性確保

## 📚 関連ドキュメント

### バックエンド仕様書
- **ファイル**: `docs/payment-uid-specification-backend.md`
- **内容**: データベース設計とAPI エンドポイントの詳細仕様
- **対象**: バックエンド開発チーム

### 実装計画書
- **ファイル**: `docs/payment-uid-implementation-plan.md`
- **内容**: バックエンドとフロントエンドの統合実装計画
- **対象**: 全開発チーム

### フロントエンド指示書
- **ファイル**: `docs/frontend-instructions.md`
- **内容**: 生成AIが直接実装できるレベルの詳細指示書
- **対象**: フロントエンド開発チーム

## 🔗 相互依存関係

### フロントエンド → バックエンド
- **payment_uid生成**: フロントエンドで生成されたpayment_uidをバックエンドが使用
- **API呼び出し**: フロントエンドがpayment_uidを使用してバックエンドAPIを呼び出す
- **決済処理**: バックエンドがpayment_uidを使用して決済処理を実行

### バックエンド → フロントエンド
- **Webhook受信**: フロントエンドで生成されたpayment_uidをバックエンドが受信
- **データ保存**: バックエンドがpayment_uidをデータベースに保存
- **API エンドポイント**: フロントエンドがpayment_uidを使用してAPIを呼び出す

---

**作成日**: 2025年9月6日  
**更新日**: 2025年9月6日  
**作成者**: AI Assistant  
**ステータス**: ✅ 完了