# フロントエンドチームへの指示書

## 📋 概要
Transaction Hub APIの実装に伴い、Nukuneフロントエンド側で必要な対応事項をまとめています。
**この指示書は生成AIが直接実装できるレベルまで詳細化されています。**

## 🎯 重要な発見事項

### データ構造の不一致
- **フロントエンドの型定義**: `subscription.ts`でサブスクリプション関連フィールドを定義済み
- **実際のFirestoreデータ**: サブスクリプション関連フィールドが未実装
- **影響**: フロントエンドの設計と実際のデータに整合性がない

### 既存データの状況
- **ユーザーデータ**: 3件存在（基本プロフィール情報のみ）
- **コレクション**: 主要コレクション（users, matches, likes等）は存在
- **サブスクリプション機能**: 未実装状態

## 📝 必要な対応事項

### 1. データ構造の統一

#### 現在のユーザーデータ構造（確認済み）
```javascript
{
  // 基本情報
  uid: string,
  email: string,
  username: string,
  gender: "male" | "female",
  age: number | null,
  birthDate: string, // YYYY-MM-DD形式
  
  // プロフィール情報
  bio: string,
  profilePhotoUrl: string,
  location: string,
  occupation: string,
  additionalPhotos: string[],
  
  // 設定・好み情報
  kinks: any[],
  interests: any[],
  partnerAgeRange: object,
  hasCompletedPreferences: boolean,
  
  // システム情報
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastPreferencesUpdate: Timestamp,
  
  // 追加フィールド
  isGirl: boolean
}
```

#### 追加が必要なサブスクリプション関連フィールド
```javascript
{
  // サブスクリプション基本情報
  plan: "free" | "1month" | "3month" | "6month" | "12month",
  planValid: boolean,
  planUpdatedAt: Timestamp,
  membershipExpiresAt: Timestamp,
  lastPaymentAt: Timestamp,
  totalPayments: number,
  currentPlanAmount: number,
  planDiscount: number,
  isPopularPlan: boolean,
  
  // サブスクリプション管理
  subscriptionStatus: "active" | "expired" | "payment_failed" | "cancelled" | "grace_period",
  nextBillingDate: Timestamp,
  failedPaymentCount: number,
  autoRetryEnabled: boolean,
  maxRetryAttempts: number,
  retryIntervalDays: number,
  
  // 解約・契約期間管理
  isCancelled: boolean,
  cancelledAt: Timestamp,
  contractEndDate: Timestamp,
  willAutoDowngrade: boolean,
  originalPlanType: string,
  cancellationReason: string
}
```

### 2. 新規コレクションの作成

#### `subscriptions/{uid}` - サブスクリプションスケジュール管理
```javascript
{
  uid: string,
  planType: "1month" | "3month" | "6month" | "12month",
  nextBillingDate: Timestamp,
  billingCycle: "monthly" | "quarterly" | "semi_annual" | "annual",
  autoRetryEnabled: boolean,
  retryAttempts: number,
  maxRetryAttempts: number,
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled",
  lastProcessedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // 解約・契約期間管理
  isCancelled: boolean,
  cancelledAt: Timestamp,
  contractEndDate: Timestamp,
  willAutoDowngrade: boolean,
  cancellationReason: string
}
```

#### `plans` - 料金プラン情報管理
```javascript
{
  planId: "1month" | "3month" | "6month" | "12month",
  planName: string,
  monthlyPrice: number,
  totalPrice: number,
  duration: number,
  discountPercentage: number,
  isPopular: boolean,
  isLimited: boolean,
  originalPrice: number,
  features: string[],
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `payment_events/{eventId}` - 冪等性制御用
```javascript
{
  provider: "telecom",
  uid: string,
  status: "pending" | "succeeded" | "failed",
  amount: number,
  currency: "JPY",
  processedAt: Timestamp,
  planType: "1month" | "3month" | "6month" | "12month"
}
```

### 3. セキュリティルールの更新

#### 現在のセキュリティルール（確認済み）
```javascript
// 既存のルール
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

#### 更新が必要なセキュリティルール
```javascript
// ユーザーデータ（読み取りのみ許可、書き込みはAdmin SDK経由）
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Admin SDK経由でのみ更新
}

// 新規コレクション
match /subscriptions/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Admin SDK経由でのみ更新
}

match /plans/{planId} {
  allow read: if request.auth != null;
  allow write: if false; // Admin SDK経由でのみ更新
}

match /payment_events/{eventId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.uid;
  allow write: if false; // Admin SDK経由でのみ更新
}
```

### 4. 型定義の更新

#### `types/subscription.ts`の更新
現在の型定義を実際のデータ構造に合わせて更新する必要があります：

```typescript
// 既存のUserWithSubscription型を実際のデータ構造に合わせて更新
export interface UserWithSubscription {
  // 既存フィールド（保持）
  uid: string;
  email: string;
  username: string;
  gender: string;
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
  plan: "free" | "1month" | "3month" | "6month" | "12month";
  planValid: boolean;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: Timestamp;
  lastPaymentAt: Timestamp;
  totalPayments: number;
  currentPlanAmount: number;
  planDiscount: number;
  isPopularPlan: boolean;
  subscriptionStatus: "active" | "expired" | "payment_failed" | "cancelled" | "grace_period";
  nextBillingDate: Timestamp;
  failedPaymentCount: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryIntervalDays: number;
  isCancelled: boolean;
  cancelledAt: Timestamp;
  contractEndDate: Timestamp;
  willAutoDowngrade: boolean;
  originalPlanType: string;
  cancellationReason: string;
}
```

### 5. データ移行の実施

#### 既存ユーザーデータへのフィールド追加
既存の3件のユーザーデータに対して、以下のデフォルト値を設定：

```javascript
// デフォルト値
{
  plan: "free",
  planValid: false,
  planUpdatedAt: createdAt, // 既存の作成日時を使用
  membershipExpiresAt: null,
  lastPaymentAt: null,
  totalPayments: 0,
  currentPlanAmount: 0,
  planDiscount: 0,
  isPopularPlan: false,
  subscriptionStatus: "expired",
  nextBillingDate: null,
  failedPaymentCount: 0,
  autoRetryEnabled: true,
  maxRetryAttempts: 3,
  retryIntervalDays: 3,
  isCancelled: false,
  cancelledAt: null,
  contractEndDate: null,
  willAutoDowngrade: true,
  originalPlanType: "free",
  cancellationReason: null
}
```

## 🚀 実装手順

### Phase 1: 準備段階
1. **セキュリティルールの更新**: `firestore.rules`を更新
2. **型定義の更新**: `types/subscription.ts`を実際のデータ構造に合わせて更新
3. **新規コレクションの作成**: `subscriptions`, `plans`, `payment_events`コレクションを作成

### Phase 2: データ移行
1. **既存ユーザーデータの更新**: 3件のユーザーデータにサブスクリプション関連フィールドを追加
2. **デフォルト値の設定**: 適切なデフォルト値を設定
3. **データ整合性の確認**: 移行後のデータ構造を確認

### Phase 3: フロントエンド実装
1. **UI更新**: サブスクリプション状況を表示するUIの実装
2. **状態管理**: サブスクリプション状態の管理
3. **エラーハンドリング**: 決済失敗時の表示

## 📞 連絡事項

### 実装スケジュール
- **Phase 1**: 1-2日
- **Phase 2**: 1日
- **Phase 3**: 3-5日

### 注意事項
1. **データの整合性**: 既存データを保持しながら新規フィールドを追加
2. **セキュリティ**: Admin SDK経由でのみデータ更新を許可
3. **パフォーマンス**: リアルタイム更新の最適化
4. **エラーハンドリング**: 決済失敗時の適切な表示

### 質問・確認事項
実装中に不明点がございましたら、以下の連絡先までお問い合わせください：
- **担当**: Transaction Hub API開発チーム
- **連絡方法**: プロジェクト管理ツールまたは直接連絡

---

**作成日**: 2025年1月7日  
**更新日**: 2025年1月7日  
**バージョン**: 1.0

---

# 🎯 生成AI実装ガイド

## 📁 ファイル構造と実装詳細

### 1. セキュリティルール更新

#### ファイル: `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 既存のヘルパー関数
    function isAdmin() {
      return request.auth != null && 
             (request.auth.token.admin == true || 
              request.auth.token.email in ['admin@nukune.com']);
    }
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // ユーザーデータ（読み取りのみ許可、書き込みはAdmin SDK経由）
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if false; // Admin SDK経由でのみ更新
    }

    // 新規コレクション
    match /subscriptions/{uid} {
      allow read: if isOwner(uid);
      allow write: if false; // Admin SDK経由でのみ更新
    }

    match /plans/{planId} {
      allow read: if isAuthenticated();
      allow write: if false; // Admin SDK経由でのみ更新
    }

    match /payment_events/{eventId} {
      allow read: if isAuthenticated() && 
                   request.auth.uid == resource.data.uid;
      allow write: if false; // Admin SDK経由でのみ更新
    }

    // 既存コレクション（既存ルールを保持）
    match /matches/{matchId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid in resource.data.users;
    }

    match /likes/{likeId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /communities/{communityId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                   request.auth.uid == resource.data.createdBy;
    }

    match /posts/{postId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                   request.auth.uid == resource.data.authorId;
    }

    match /memos/{memoId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /memoHistory/{historyId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /profileViews/{viewId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.viewerId;
    }

    match /userSettings/{uid} {
      allow read, write: if isOwner(uid);
    }

    match /malePreferences/{uid} {
      allow read, write: if isOwner(uid);
    }

    match /publicStats/{statId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

### 2. 型定義の更新

#### ファイル: `src/types/subscription.ts`
```typescript
import { Timestamp } from 'firebase/firestore';

// プラン種別
export type PlanType = "free" | "1month" | "3month" | "6month" | "12month";

// サブスクリプションステータス
export type SubscriptionStatus = "active" | "expired" | "payment_failed" | "cancelled" | "grace_period";

// 決済サイクル
export type BillingCycle = "monthly" | "quarterly" | "semi_annual" | "annual";

// 決済ステータス
export type PaymentStatus = "pending" | "succeeded" | "failed";

// サブスクリプション基本情報
export interface SubscriptionBasicInfo {
  plan: PlanType;
  planValid: boolean;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: Timestamp | null;
  lastPaymentAt: Timestamp | null;
  totalPayments: number;
  currentPlanAmount: number;
  planDiscount: number;
  isPopularPlan: boolean;
}

// サブスクリプション管理情報
export interface SubscriptionManagement {
  subscriptionStatus: SubscriptionStatus;
  nextBillingDate: Timestamp | null;
  failedPaymentCount: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryIntervalDays: number;
}

// 解約・契約期間管理情報
export interface CancellationInfo {
  isCancelled: boolean;
  cancelledAt: Timestamp | null;
  contractEndDate: Timestamp | null;
  willAutoDowngrade: boolean;
  originalPlanType: string;
  cancellationReason: string | null;
}

// 更新されたユーザー型（既存フィールド + 新規フィールド）
export interface UserWithSubscription {
  // 既存フィールド（保持）
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
  ...SubscriptionBasicInfo;
  ...SubscriptionManagement;
  ...CancellationInfo;
}

// サブスクリプションスケジュール管理
export interface SubscriptionSchedule {
  uid: string;
  planType: PlanType;
  nextBillingDate: Timestamp;
  billingCycle: BillingCycle;
  autoRetryEnabled: boolean;
  retryAttempts: number;
  maxRetryAttempts: number;
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  lastProcessedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ...CancellationInfo;
}

// 料金プラン情報
export interface PlanInfo {
  planId: PlanType;
  planName: string;
  monthlyPrice: number;
  totalPrice: number;
  duration: number;
  discountPercentage: number;
  isPopular: boolean;
  isLimited: boolean;
  originalPrice: number;
  features: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 決済イベント
export interface PaymentEvent {
  provider: "telecom";
  uid: string;
  status: PaymentStatus;
  amount: number;
  currency: "JPY";
  processedAt: Timestamp;
  planType: PlanType;
}

// デフォルト値の型
export interface SubscriptionDefaults {
  plan: "free";
  planValid: false;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: null;
  lastPaymentAt: null;
  totalPayments: 0;
  currentPlanAmount: 0;
  planDiscount: 0;
  isPopularPlan: false;
  subscriptionStatus: "expired";
  nextBillingDate: null;
  failedPaymentCount: 0;
  autoRetryEnabled: true;
  maxRetryAttempts: 3;
  retryIntervalDays: 3;
  isCancelled: false;
  cancelledAt: null;
  contractEndDate: null;
  willAutoDowngrade: true;
  originalPlanType: "free";
  cancellationReason: null;
}
```

### 3. データ移行スクリプト

#### ファイル: `scripts/migrate-subscription-data.js`
```javascript
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { cert } = require('firebase-admin/auth');

// Firebase Admin SDK初期化
const serviceAccount = require('../nukune-e72e97115cbd.json');
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'nukune'
});

const db = getFirestore(app);

// デフォルト値の定義
const getDefaultSubscriptionData = (createdAt) => ({
  plan: "free",
  planValid: false,
  planUpdatedAt: createdAt,
  membershipExpiresAt: null,
  lastPaymentAt: null,
  totalPayments: 0,
  currentPlanAmount: 0,
  planDiscount: 0,
  isPopularPlan: false,
  subscriptionStatus: "expired",
  nextBillingDate: null,
  failedPaymentCount: 0,
  autoRetryEnabled: true,
  maxRetryAttempts: 3,
  retryIntervalDays: 3,
  isCancelled: false,
  cancelledAt: null,
  contractEndDate: null,
  willAutoDowngrade: true,
  originalPlanType: "free",
  cancellationReason: null
});

// 料金プランデータの作成
const createPlanData = async () => {
  const plans = [
    {
      planId: "1month",
      planName: "1ヶ月プラン",
      monthlyPrice: 1980,
      totalPrice: 1980,
      duration: 1,
      discountPercentage: 0,
      isPopular: false,
      isLimited: true,
      originalPrice: 1980,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "3month",
      planName: "3ヶ月プラン",
      monthlyPrice: 1550,
      totalPrice: 4650,
      duration: 3,
      discountPercentage: 22,
      isPopular: false,
      isLimited: false,
      originalPrice: 5940,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "6month",
      planName: "6ヶ月プラン",
      monthlyPrice: 1350,
      totalPrice: 8100,
      duration: 6,
      discountPercentage: 32,
      isPopular: true,
      isLimited: false,
      originalPrice: 11880,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "12month",
      planName: "12ヶ月プラン",
      monthlyPrice: 1150,
      totalPrice: 13800,
      duration: 12,
      discountPercentage: 42,
      isPopular: false,
      isLimited: false,
      originalPrice: 23760,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const plan of plans) {
    await db.collection('plans').doc(plan.planId).set(plan);
    console.log(`✅ プラン ${plan.planName} を作成しました`);
  }
};

// 既存ユーザーデータの移行
const migrateUserData = async () => {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️ 移行対象のユーザーデータが見つかりません');
      return;
    }

    console.log(`📊 ${usersSnapshot.size}件のユーザーデータを移行します`);

    const batch = db.batch();
    let updatedCount = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      // 既にサブスクリプションフィールドが存在するかチェック
      if (userData.plan !== undefined) {
        console.log(`⚠️ ユーザー ${doc.id} は既に移行済みです`);
        return;
      }

      // デフォルト値を追加
      const defaultData = getDefaultSubscriptionData(userData.createdAt);
      const updatedData = { ...userData, ...defaultData };

      batch.update(doc.ref, updatedData);
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ ${updatedCount}件のユーザーデータを移行しました`);
    } else {
      console.log('ℹ️ 移行対象のデータがありませんでした');
    }

  } catch (error) {
    console.error('❌ データ移行中にエラーが発生しました:', error);
    throw error;
  }
};

// メイン実行関数
const main = async () => {
  try {
    console.log('🚀 データ移行を開始します...');
    
    // 1. 料金プランデータの作成
    console.log('\n📋 料金プランデータを作成中...');
    await createPlanData();
    
    // 2. 既存ユーザーデータの移行
    console.log('\n👥 既存ユーザーデータを移行中...');
    await migrateUserData();
    
    console.log('\n🎉 データ移行が完了しました！');
    
  } catch (error) {
    console.error('❌ 移行に失敗しました:', error);
    process.exit(1);
  }
};

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { migrateUserData, createPlanData };
```

### 4. フックの作成

#### ファイル: `src/hooks/useSubscription.ts`
```typescript
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserWithSubscription, SubscriptionStatus } from '@/types/subscription';

export const useSubscription = (uid: string) => {
  const [user, setUser] = useState<UserWithSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (doc) => {
        if (doc.exists()) {
          setUser(doc.data() as UserWithSubscription);
        } else {
          setError('ユーザーが見つかりません');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Subscription hook error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // サブスクリプション状態の判定
  const isPremium = user?.subscriptionStatus === 'active';
  const isExpired = user?.subscriptionStatus === 'expired';
  const isPaymentFailed = user?.subscriptionStatus === 'payment_failed';
  const isCancelled = user?.isCancelled;
  const isInGracePeriod = user?.subscriptionStatus === 'grace_period';

  // 残り日数の計算
  const getRemainingDays = () => {
    if (!user?.membershipExpiresAt) return 0;
    const now = new Date();
    const expiresAt = user.membershipExpiresAt.toDate();
    const diffTime = expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 次回決済日の取得
  const getNextBillingDate = () => {
    return user?.nextBillingDate?.toDate() || null;
  };

  // プラン情報の取得
  const getPlanInfo = () => {
    if (!user) return null;
    
    const planNames = {
      free: '無料プラン',
      '1month': '1ヶ月プラン',
      '3month': '3ヶ月プラン',
      '6month': '6ヶ月プラン',
      '12month': '12ヶ月プラン'
    };

    return {
      name: planNames[user.plan] || '不明',
      type: user.plan,
      amount: user.currentPlanAmount,
      discount: user.planDiscount,
      isPopular: user.isPopularPlan
    };
  };

  return {
    user,
    loading,
    error,
    isPremium,
    isExpired,
    isPaymentFailed,
    isCancelled,
    isInGracePeriod,
    getRemainingDays,
    getNextBillingDate,
    getPlanInfo
  };
};
```

### 5. コンポーネントの作成

#### ファイル: `src/components/subscription/SubscriptionStatus.tsx`
```typescript
import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SubscriptionStatusProps {
  uid: string;
  onUpgrade?: () => void;
  onManage?: () => void;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  uid,
  onUpgrade,
  onManage
}) => {
  const {
    user,
    loading,
    error,
    isPremium,
    isExpired,
    isPaymentFailed,
    isCancelled,
    isInGracePeriod,
    getRemainingDays,
    getNextBillingDate,
    getPlanInfo
  } = useSubscription(uid);

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
          <div className="flex items-center text-red-600">
            <XCircle className="w-5 h-5 mr-2" />
            <span>エラーが発生しました: {error}</span>
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

  const planInfo = getPlanInfo();
  const remainingDays = getRemainingDays();
  const nextBillingDate = getNextBillingDate();

  const getStatusBadge = () => {
    if (isPremium) {
      return <Badge className="bg-green-100 text-green-800">アクティブ</Badge>;
    }
    if (isInGracePeriod) {
      return <Badge className="bg-yellow-100 text-yellow-800">猶予期間</Badge>;
    }
    if (isPaymentFailed) {
      return <Badge className="bg-red-100 text-red-800">決済失敗</Badge>;
    }
    if (isCancelled) {
      return <Badge className="bg-gray-100 text-gray-800">解約済み</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">無料</Badge>;
  };

  const getStatusIcon = () => {
    if (isPremium) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (isPaymentFailed || isExpired) {
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
    if (isInGracePeriod) {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
    return <CreditCard className="w-5 h-5 text-gray-600" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>サブスクリプション状況</span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <p className="font-medium">{planInfo?.name}</p>
            {planInfo?.amount > 0 && (
              <p className="text-sm text-gray-600">
                ¥{planInfo.amount.toLocaleString()}/月
                {planInfo.discount > 0 && (
                  <span className="ml-2 text-green-600">
                    ({planInfo.discount}%割引)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {isPremium && remainingDays > 0 && (
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>残り {remainingDays} 日</span>
          </div>
        )}

        {nextBillingDate && (
          <div className="flex items-center text-sm text-gray-600">
            <CreditCard className="w-4 h-4 mr-2" />
            <span>次回決済: {nextBillingDate.toLocaleDateString()}</span>
          </div>
        )}

        {isPaymentFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center text-red-800">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">決済に失敗しました</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              お支払い方法を確認してください
            </p>
          </div>
        )}

        {isInGracePeriod && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center text-yellow-800">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">猶予期間中</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              決済が完了するまで機能が制限されます
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isPremium && onUpgrade && (
            <Button onClick={onUpgrade} className="flex-1">
              プランアップグレード
            </Button>
          )}
          {isPremium && onManage && (
            <Button variant="outline" onClick={onManage} className="flex-1">
              管理
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

### 6. 実装チェックリスト

#### Phase 1: 準備段階（1-2日）
- [ ] `firestore.rules`を更新
- [ ] `src/types/subscription.ts`を更新
- [ ] `scripts/migrate-subscription-data.js`を作成
- [ ] `src/hooks/useSubscription.ts`を作成
- [ ] `src/components/subscription/SubscriptionStatus.tsx`を作成

#### Phase 2: データ移行（1日）
- [ ] 料金プランデータの作成
- [ ] 既存ユーザーデータの移行
- [ ] データ整合性の確認

#### Phase 3: フロントエンド実装（3-5日）
- [ ] サブスクリプション状況表示UIの実装
- [ ] 決済失敗時のエラーハンドリング
- [ ] 猶予期間中の表示
- [ ] プラン管理画面の実装

### 7. テスト手順

#### データ移行テスト
```bash
# 1. 移行スクリプトの実行
node scripts/migrate-subscription-data.js

# 2. Firestoreコンソールでデータ確認
# - users/{uid}にサブスクリプションフィールドが追加されているか
# - plansコレクションに料金プランデータが作成されているか

# 3. セキュリティルールのテスト
# - 認証ユーザーが自分のデータを読み取れるか
# - 認証ユーザーがデータを書き込めないか（Admin SDK経由のみ）
```

#### フロントエンドテスト
```bash
# 1. 開発サーバーの起動
npm run dev

# 2. サブスクリプション状況表示の確認
# - 無料ユーザーの表示
# - 有料ユーザーの表示
# - 決済失敗時の表示
# - 猶予期間中の表示

# 3. リアルタイム更新の確認
# - Firestoreデータ変更時のUI更新
```

この実装ガイドにより、生成AIが直接実装できるレベルまで詳細化されました。

---

# 🎯 生成AI実装ガイド

## 📁 ファイル構造と実装詳細

### 1. セキュリティルール更新

#### ファイル: `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 既存のヘルパー関数
    function isAdmin() {
      return request.auth != null && 
             (request.auth.token.admin == true || 
              request.auth.token.email in ['admin@nukune.com']);
    }
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // ユーザーデータ（読み取りのみ許可、書き込みはAdmin SDK経由）
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if false; // Admin SDK経由でのみ更新
    }

    // 新規コレクション
    match /subscriptions/{uid} {
      allow read: if isOwner(uid);
      allow write: if false; // Admin SDK経由でのみ更新
    }

    match /plans/{planId} {
      allow read: if isAuthenticated();
      allow write: if false; // Admin SDK経由でのみ更新
    }

    match /payment_events/{eventId} {
      allow read: if isAuthenticated() && 
                   request.auth.uid == resource.data.uid;
      allow write: if false; // Admin SDK経由でのみ更新
    }

    // 既存コレクション（既存ルールを保持）
    match /matches/{matchId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid in resource.data.users;
    }

    match /likes/{likeId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /communities/{communityId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                   request.auth.uid == resource.data.createdBy;
    }

    match /posts/{postId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                   request.auth.uid == resource.data.authorId;
    }

    match /memos/{memoId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /memoHistory/{historyId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.userId;
    }

    match /profileViews/{viewId} {
      allow read, write: if isAuthenticated() && 
                         request.auth.uid == resource.data.viewerId;
    }

    match /userSettings/{uid} {
      allow read, write: if isOwner(uid);
    }

    match /malePreferences/{uid} {
      allow read, write: if isOwner(uid);
    }

    match /publicStats/{statId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

### 2. 型定義の更新

#### ファイル: `src/types/subscription.ts`
```typescript
import { Timestamp } from 'firebase/firestore';

// プラン種別
export type PlanType = "free" | "1month" | "3month" | "6month" | "12month";

// サブスクリプションステータス
export type SubscriptionStatus = "active" | "expired" | "payment_failed" | "cancelled" | "grace_period";

// 決済サイクル
export type BillingCycle = "monthly" | "quarterly" | "semi_annual" | "annual";

// 決済ステータス
export type PaymentStatus = "pending" | "succeeded" | "failed";

// サブスクリプション基本情報
export interface SubscriptionBasicInfo {
  plan: PlanType;
  planValid: boolean;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: Timestamp | null;
  lastPaymentAt: Timestamp | null;
  totalPayments: number;
  currentPlanAmount: number;
  planDiscount: number;
  isPopularPlan: boolean;
}

// サブスクリプション管理情報
export interface SubscriptionManagement {
  subscriptionStatus: SubscriptionStatus;
  nextBillingDate: Timestamp | null;
  failedPaymentCount: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryIntervalDays: number;
}

// 解約・契約期間管理情報
export interface CancellationInfo {
  isCancelled: boolean;
  cancelledAt: Timestamp | null;
  contractEndDate: Timestamp | null;
  willAutoDowngrade: boolean;
  originalPlanType: string;
  cancellationReason: string | null;
}

// 更新されたユーザー型（既存フィールド + 新規フィールド）
export interface UserWithSubscription {
  // 既存フィールド（保持）
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
  ...SubscriptionBasicInfo;
  ...SubscriptionManagement;
  ...CancellationInfo;
}

// サブスクリプションスケジュール管理
export interface SubscriptionSchedule {
  uid: string;
  planType: PlanType;
  nextBillingDate: Timestamp;
  billingCycle: BillingCycle;
  autoRetryEnabled: boolean;
  retryAttempts: number;
  maxRetryAttempts: number;
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  lastProcessedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ...CancellationInfo;
}

// 料金プラン情報
export interface PlanInfo {
  planId: PlanType;
  planName: string;
  monthlyPrice: number;
  totalPrice: number;
  duration: number;
  discountPercentage: number;
  isPopular: boolean;
  isLimited: boolean;
  originalPrice: number;
  features: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 決済イベント
export interface PaymentEvent {
  provider: "telecom";
  uid: string;
  status: PaymentStatus;
  amount: number;
  currency: "JPY";
  processedAt: Timestamp;
  planType: PlanType;
}

// デフォルト値の型
export interface SubscriptionDefaults {
  plan: "free";
  planValid: false;
  planUpdatedAt: Timestamp;
  membershipExpiresAt: null;
  lastPaymentAt: null;
  totalPayments: 0;
  currentPlanAmount: 0;
  planDiscount: 0;
  isPopularPlan: false;
  subscriptionStatus: "expired";
  nextBillingDate: null;
  failedPaymentCount: 0;
  autoRetryEnabled: true;
  maxRetryAttempts: 3;
  retryIntervalDays: 3;
  isCancelled: false;
  cancelledAt: null;
  contractEndDate: null;
  willAutoDowngrade: true;
  originalPlanType: "free";
  cancellationReason: null;
}
```

### 3. データ移行スクリプト

#### ファイル: `scripts/migrate-subscription-data.js`
```javascript
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { cert } = require('firebase-admin/auth');

// Firebase Admin SDK初期化
const serviceAccount = require('../nukune-e72e97115cbd.json');
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'nukune'
});

const db = getFirestore(app);

// デフォルト値の定義
const getDefaultSubscriptionData = (createdAt) => ({
  plan: "free",
  planValid: false,
  planUpdatedAt: createdAt,
  membershipExpiresAt: null,
  lastPaymentAt: null,
  totalPayments: 0,
  currentPlanAmount: 0,
  planDiscount: 0,
  isPopularPlan: false,
  subscriptionStatus: "expired",
  nextBillingDate: null,
  failedPaymentCount: 0,
  autoRetryEnabled: true,
  maxRetryAttempts: 3,
  retryIntervalDays: 3,
  isCancelled: false,
  cancelledAt: null,
  contractEndDate: null,
  willAutoDowngrade: true,
  originalPlanType: "free",
  cancellationReason: null
});

// 料金プランデータの作成
const createPlanData = async () => {
  const plans = [
    {
      planId: "1month",
      planName: "1ヶ月プラン",
      monthlyPrice: 1980,
      totalPrice: 1980,
      duration: 1,
      discountPercentage: 0,
      isPopular: false,
      isLimited: true,
      originalPrice: 1980,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "3month",
      planName: "3ヶ月プラン",
      monthlyPrice: 1550,
      totalPrice: 4650,
      duration: 3,
      discountPercentage: 22,
      isPopular: false,
      isLimited: false,
      originalPrice: 5940,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "6month",
      planName: "6ヶ月プラン",
      monthlyPrice: 1350,
      totalPrice: 8100,
      duration: 6,
      discountPercentage: 32,
      isPopular: true,
      isLimited: false,
      originalPrice: 11880,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: "12month",
      planName: "12ヶ月プラン",
      monthlyPrice: 1150,
      totalPrice: 13800,
      duration: 12,
      discountPercentage: 42,
      isPopular: false,
      isLimited: false,
      originalPrice: 23760,
      features: ["基本機能", "プロフィール閲覧", "マッチング機能", "カスタマーサポート"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const plan of plans) {
    await db.collection('plans').doc(plan.planId).set(plan);
    console.log(`✅ プラン ${plan.planName} を作成しました`);
  }
};

// 既存ユーザーデータの移行
const migrateUserData = async () => {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️ 移行対象のユーザーデータが見つかりません');
      return;
    }

    console.log(`📊 ${usersSnapshot.size}件のユーザーデータを移行します`);

    const batch = db.batch();
    let updatedCount = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      // 既にサブスクリプションフィールドが存在するかチェック
      if (userData.plan !== undefined) {
        console.log(`⚠️ ユーザー ${doc.id} は既に移行済みです`);
        return;
      }

      // デフォルト値を追加
      const defaultData = getDefaultSubscriptionData(userData.createdAt);
      const updatedData = { ...userData, ...defaultData };

      batch.update(doc.ref, updatedData);
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ ${updatedCount}件のユーザーデータを移行しました`);
    } else {
      console.log('ℹ️ 移行対象のデータがありませんでした');
    }

  } catch (error) {
    console.error('❌ データ移行中にエラーが発生しました:', error);
    throw error;
  }
};

// メイン実行関数
const main = async () => {
  try {
    console.log('🚀 データ移行を開始します...');
    
    // 1. 料金プランデータの作成
    console.log('\n📋 料金プランデータを作成中...');
    await createPlanData();
    
    // 2. 既存ユーザーデータの移行
    console.log('\n👥 既存ユーザーデータを移行中...');
    await migrateUserData();
    
    console.log('\n🎉 データ移行が完了しました！');
    
  } catch (error) {
    console.error('❌ 移行に失敗しました:', error);
    process.exit(1);
  }
};

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { migrateUserData, createPlanData };
```

### 4. フックの作成

#### ファイル: `src/hooks/useSubscription.ts`
```typescript
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserWithSubscription, SubscriptionStatus } from '@/types/subscription';

export const useSubscription = (uid: string) => {
  const [user, setUser] = useState<UserWithSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (doc) => {
        if (doc.exists()) {
          setUser(doc.data() as UserWithSubscription);
        } else {
          setError('ユーザーが見つかりません');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Subscription hook error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // サブスクリプション状態の判定
  const isPremium = user?.subscriptionStatus === 'active';
  const isExpired = user?.subscriptionStatus === 'expired';
  const isPaymentFailed = user?.subscriptionStatus === 'payment_failed';
  const isCancelled = user?.isCancelled;
  const isInGracePeriod = user?.subscriptionStatus === 'grace_period';

  // 残り日数の計算
  const getRemainingDays = () => {
    if (!user?.membershipExpiresAt) return 0;
    const now = new Date();
    const expiresAt = user.membershipExpiresAt.toDate();
    const diffTime = expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 次回決済日の取得
  const getNextBillingDate = () => {
    return user?.nextBillingDate?.toDate() || null;
  };

  // プラン情報の取得
  const getPlanInfo = () => {
    if (!user) return null;
    
    const planNames = {
      free: '無料プラン',
      '1month': '1ヶ月プラン',
      '3month': '3ヶ月プラン',
      '6month': '6ヶ月プラン',
      '12month': '12ヶ月プラン'
    };

    return {
      name: planNames[user.plan] || '不明',
      type: user.plan,
      amount: user.currentPlanAmount,
      discount: user.planDiscount,
      isPopular: user.isPopularPlan
    };
  };

  return {
    user,
    loading,
    error,
    isPremium,
    isExpired,
    isPaymentFailed,
    isCancelled,
    isInGracePeriod,
    getRemainingDays,
    getNextBillingDate,
    getPlanInfo
  };
};
```

### 5. コンポーネントの作成

#### ファイル: `src/components/subscription/SubscriptionStatus.tsx`
```typescript
import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SubscriptionStatusProps {
  uid: string;
  onUpgrade?: () => void;
  onManage?: () => void;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  uid,
  onUpgrade,
  onManage
}) => {
  const {
    user,
    loading,
    error,
    isPremium,
    isExpired,
    isPaymentFailed,
    isCancelled,
    isInGracePeriod,
    getRemainingDays,
    getNextBillingDate,
    getPlanInfo
  } = useSubscription(uid);

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
          <div className="flex items-center text-red-600">
            <XCircle className="w-5 h-5 mr-2" />
            <span>エラーが発生しました: {error}</span>
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

  const planInfo = getPlanInfo();
  const remainingDays = getRemainingDays();
  const nextBillingDate = getNextBillingDate();

  const getStatusBadge = () => {
    if (isPremium) {
      return <Badge className="bg-green-100 text-green-800">アクティブ</Badge>;
    }
    if (isInGracePeriod) {
      return <Badge className="bg-yellow-100 text-yellow-800">猶予期間</Badge>;
    }
    if (isPaymentFailed) {
      return <Badge className="bg-red-100 text-red-800">決済失敗</Badge>;
    }
    if (isCancelled) {
      return <Badge className="bg-gray-100 text-gray-800">解約済み</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">無料</Badge>;
  };

  const getStatusIcon = () => {
    if (isPremium) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (isPaymentFailed || isExpired) {
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
    if (isInGracePeriod) {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
    return <CreditCard className="w-5 h-5 text-gray-600" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>サブスクリプション状況</span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <p className="font-medium">{planInfo?.name}</p>
            {planInfo?.amount > 0 && (
              <p className="text-sm text-gray-600">
                ¥{planInfo.amount.toLocaleString()}/月
                {planInfo.discount > 0 && (
                  <span className="ml-2 text-green-600">
                    ({planInfo.discount}%割引)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {isPremium && remainingDays > 0 && (
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>残り {remainingDays} 日</span>
          </div>
        )}

        {nextBillingDate && (
          <div className="flex items-center text-sm text-gray-600">
            <CreditCard className="w-4 h-4 mr-2" />
            <span>次回決済: {nextBillingDate.toLocaleDateString()}</span>
          </div>
        )}

        {isPaymentFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center text-red-800">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">決済に失敗しました</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              お支払い方法を確認してください
            </p>
          </div>
        )}

        {isInGracePeriod && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center text-yellow-800">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">猶予期間中</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              決済が完了するまで機能が制限されます
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isPremium && onUpgrade && (
            <Button onClick={onUpgrade} className="flex-1">
              プランアップグレード
            </Button>
          )}
          {isPremium && onManage && (
            <Button variant="outline" onClick={onManage} className="flex-1">
              管理
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

### 6. 実装チェックリスト

#### Phase 1: 準備段階（1-2日）
- [ ] `firestore.rules`を更新
- [ ] `src/types/subscription.ts`を更新
- [ ] `scripts/migrate-subscription-data.js`を作成
- [ ] `src/hooks/useSubscription.ts`を作成
- [ ] `src/components/subscription/SubscriptionStatus.tsx`を作成

#### Phase 2: データ移行（1日）
- [ ] 料金プランデータの作成
- [ ] 既存ユーザーデータの移行
- [ ] データ整合性の確認

#### Phase 3: フロントエンド実装（3-5日）
- [ ] サブスクリプション状況表示UIの実装
- [ ] 決済失敗時のエラーハンドリング
- [ ] 猶予期間中の表示
- [ ] プラン管理画面の実装

### 7. テスト手順

#### データ移行テスト
```bash
# 1. 移行スクリプトの実行
node scripts/migrate-subscription-data.js

# 2. Firestoreコンソールでデータ確認
# - users/{uid}にサブスクリプションフィールドが追加されているか
# - plansコレクションに料金プランデータが作成されているか

# 3. セキュリティルールのテスト
# - 認証ユーザーが自分のデータを読み取れるか
# - 認証ユーザーがデータを書き込めないか（Admin SDK経由のみ）
```

#### フロントエンドテスト
```bash
# 1. 開発サーバーの起動
npm run dev

# 2. サブスクリプション状況表示の確認
# - 無料ユーザーの表示
# - 有料ユーザーの表示
# - 決済失敗時の表示
# - 猶予期間中の表示

# 3. リアルタイム更新の確認
# - Firestoreデータ変更時のUI更新
```

この実装ガイドにより、生成AIが直接実装できるレベルまで詳細化されました。