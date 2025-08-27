# Nukune プレミアム会員システム & 7日間無料トライアル仕様書

## 1. システム概要

### 1.1 目的
- 新規ユーザー獲得のための7日間無料トライアル提供
- 有料会員への転換促進
- 継続的な収益モデルの構築

### 1.2 主要機能
- 7日間の無料トライアル（新規ユーザー限定）
- 月額サブスクリプション管理
- 自動更新・解約機能
- 支払い履歴管理

## 2. データモデル設計

### 2.1 Firestore データ構造

```typescript
// users コレクション
interface User {
  // 基本情報
  uid: string;
  email: string;
  createdAt: Timestamp;
  
  // トライアル関連
  trial: {
    startDate: Timestamp | null;      // トライアル開始日時
    endDate: Timestamp | null;        // トライアル終了日時
    isActive: boolean;                // トライアル有効フラグ
    hasUsed: boolean;                 // トライアル使用済みフラグ
    source: 'campaign_2025' | string; // トライアル取得元
  };
  
  // サブスクリプション関連
  subscription: {
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
    currentPeriodStart: Timestamp | null;  // 現在の請求期間開始日
    currentPeriodEnd: Timestamp | null;    // 現在の請求期間終了日
    cancelAtPeriodEnd: boolean;           // 期間終了時に解約するか
    canceledAt: Timestamp | null;          // 解約日時
    pausedAt: Timestamp | null;           // 一時停止日時
  };
  
  // 支払い関連
  billing: {
    customerId: string | null;        // Stripe Customer ID
    paymentMethodId: string | null;   // デフォルト支払い方法
    lastPaymentDate: Timestamp | null;
    nextBillingDate: Timestamp | null;
  };
  
  // アクセス権限
  isPremium: boolean;  // プレミアム機能へのアクセス権（トライアル中 OR 有料会員）
}

// subscriptions コレクション（履歴管理）
interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'canceled' | 'expired';
  planId: 'monthly' | 'yearly';
  amount: number;
  currency: 'JPY';
  startDate: Timestamp;
  endDate: Timestamp | null;
  canceledAt: Timestamp | null;
  cancelReason: string | null;
  stripeSubscriptionId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// payments コレクション（支払い履歴）
interface Payment {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: 'JPY';
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  paymentMethod: 'card' | 'bank_transfer';
  stripePaymentIntentId: string;
  failureReason: string | null;
  refundedAmount: number | null;
  createdAt: Timestamp;
}

// trial_campaigns コレクション（キャンペーン管理）
interface TrialCampaign {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp | null;
  trialDays: number;
  isActive: boolean;
  description: string;
  createdAt: Timestamp;
}
```

## 3. ビジネスロジック

### 3.1 ユーザーステータス判定

```typescript
enum UserSubscriptionStatus {
  TRIAL_ACTIVE = 'trial_active',           // トライアル期間中
  TRIAL_EXPIRED = 'trial_expired',         // トライアル期限切れ
  PREMIUM_ACTIVE = 'premium_active',       // 有料会員（アクティブ）
  PREMIUM_CANCELED = 'premium_canceled',   // 有料会員（解約予定）
  FREE = 'free'                           // 無料会員
}

function getUserStatus(user: User): UserSubscriptionStatus {
  const now = new Date();
  
  // 有料会員チェック
  if (user.subscription.status === 'active') {
    if (user.subscription.cancelAtPeriodEnd) {
      return UserSubscriptionStatus.PREMIUM_CANCELED;
    }
    return UserSubscriptionStatus.PREMIUM_ACTIVE;
  }
  
  // トライアルチェック
  if (user.trial.isActive && user.trial.endDate) {
    if (user.trial.endDate.toDate() > now) {
      return UserSubscriptionStatus.TRIAL_ACTIVE;
    }
    return UserSubscriptionStatus.TRIAL_EXPIRED;
  }
  
  return UserSubscriptionStatus.FREE;
}

function hasPremiuimAccess(user: User): boolean {
  const status = getUserStatus(user);
  return status === UserSubscriptionStatus.TRIAL_ACTIVE || 
         status === UserSubscriptionStatus.PREMIUM_ACTIVE ||
         status === UserSubscriptionStatus.PREMIUM_CANCELED;
}
```

### 3.2 トライアル期間計算

```typescript
interface TrialInfo {
  isActive: boolean;
  daysUsed: number;
  daysRemaining: number;
  hoursRemaining: number;
  expiresAt: Date | null;
  message: string;
}

function getTrialInfo(user: User): TrialInfo {
  if (!user.trial.isActive || !user.trial.endDate) {
    return {
      isActive: false,
      daysUsed: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      expiresAt: null,
      message: 'トライアル期間外'
    };
  }
  
  const now = new Date();
  const endDate = user.trial.endDate.toDate();
  const startDate = user.trial.startDate.toDate();
  
  const totalMs = endDate.getTime() - startDate.getTime();
  const usedMs = now.getTime() - startDate.getTime();
  const remainingMs = endDate.getTime() - now.getTime();
  
  const daysUsed = Math.floor(usedMs / (1000 * 60 * 60 * 24)) + 1;
  const daysRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  
  let message = '';
  if (daysRemaining > 1) {
    message = `プレミアム機能をあと${daysRemaining}日間無料でお試しいただけます`;
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
```

### 3.3 サブスクリプション期間管理

```typescript
interface SubscriptionInfo {
  isActive: boolean;
  willRenew: boolean;
  daysRemaining: number;
  nextBillingDate: Date | null;
  cancelationDate: Date | null;
  amount: number;
  message: string;
}

function getSubscriptionInfo(user: User): SubscriptionInfo {
  if (user.subscription.status !== 'active') {
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
  const periodEnd = user.subscription.currentPeriodEnd?.toDate();
  
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
  if (user.subscription.cancelAtPeriodEnd) {
    message = `${periodEnd.toLocaleDateString('ja-JP')}に解約予定`;
  } else {
    message = `次回更新日: ${periodEnd.toLocaleDateString('ja-JP')}`;
  }
  
  return {
    isActive: true,
    willRenew: !user.subscription.cancelAtPeriodEnd,
    daysRemaining,
    nextBillingDate: user.subscription.cancelAtPeriodEnd ? null : periodEnd,
    cancelationDate: user.subscription.cancelAtPeriodEnd ? periodEnd : null,
    amount: 1980, // 月額料金
    message
  };
}
```

## 4. UI/UX デザイン仕様

### 4.1 トライアル表示バッジ

#### ヘッダー表示
```typescript
// components/TrialBadge.tsx
interface TrialBadgeProps {
  user: User;
}

// 表示例：
// 🎁 お試し3日目（あと4日）- 背景: #FFE4E1（薄いピンク）
// ⚠️ お試し最終日！ - 背景: #FFB6C1（警告ピンク）
// ✨ お試し期間中 - 背景: #F0306A（メインカラー）
```

### 4.2 ログイン時モーダル

#### モーダルタイプ
1. **トライアル開始モーダル**（初回ログイン時）
2. **トライアル進捗モーダル**（2-6日目）
3. **トライアル終了前警告**（最終日）
4. **トライアル終了モーダル**（8日目以降）
5. **有料会員登録完了モーダル**
6. **解約確認モーダル**

### 4.3 マイページ表示

```typescript
interface MyPageSubscriptionSection {
  // 無料会員 + トライアル中
  trialSection?: {
    badge: '🎁 7日間無料お試し中';
    progress: '3日目 / 7日間';
    progressBar: 42; // パーセント
    expiryDate: '2025/02/03 23:59';
    upgradeButton: 'プレミアム会員になる（初月50%OFF）';
  };
  
  // 有料会員
  premiumSection?: {
    badge: '👑 プレミアム会員';
    plan: '月額プラン ¥1,980/月';
    nextBilling: '次回請求日: 2025/02/10';
    paymentMethod: 'Visa ****1234';
    buttons: {
      changePayment: '支払い方法を変更';
      viewHistory: '請求履歴を確認';
      cancel: 'プランを解約';
    };
  };
  
  // 解約予定
  cancelingSection?: {
    badge: '⚠️ 解約予定';
    message: '2025/02/10にプレミアム会員が終了します';
    remainingDays: 'あと5日間ご利用いただけます';
    reactivateButton: '解約を取り消す';
  };
}
```

## 5. 決済フロー

### 5.1 Stripe Integration

```typescript
// 決済フロー
async function upgradeToPremium(userId: string) {
  try {
    // 1. Stripe Customer作成（初回のみ）
    const customer = await createStripeCustomer(userId);
    
    // 2. 支払い方法の設定
    const paymentMethod = await attachPaymentMethod(customer.id);
    
    // 3. サブスクリプション作成
    const subscription = await createSubscription({
      customerId: customer.id,
      paymentMethodId: paymentMethod.id,
      priceId: 'price_monthly_1980',
      trialEnd: null // トライアル中の場合は即座に課金開始
    });
    
    // 4. Firestore更新
    await updateUserSubscription(userId, {
      'subscription.status': 'active',
      'subscription.currentPeriodStart': subscription.current_period_start,
      'subscription.currentPeriodEnd': subscription.current_period_end,
      'billing.customerId': customer.id,
      'billing.paymentMethodId': paymentMethod.id,
      'isPremium': true,
      'trial.isActive': false // トライアル終了
    });
    
    // 5. 支払い履歴記録
    await recordPayment(userId, subscription);
    
  } catch (error) {
    // エラーハンドリング
    throw new PaymentError(error);
  }
}
```

### 5.2 自動更新処理

```typescript
// Cloud Functions（毎日実行）
export const checkSubscriptions = functions.pubsub
  .schedule('every day 00:00')
  .onRun(async (context) => {
    // 1. 期限切れトライアルの無効化
    await disableExpiredTrials();
    
    // 2. サブスクリプション更新確認
    await processSubscriptionRenewals();
    
    // 3. 解約予定の処理
    await processCancelations();
    
    // 4. 支払い失敗の再試行
    await retryFailedPayments();
  });
```

## 6. 通知システム

### 6.1 通知タイミング
- トライアル開始時
- トライアル残り3日
- トライアル最終日
- トライアル終了
- 有料会員登録完了
- 支払い成功/失敗
- 解約完了
- 更新3日前

### 6.2 通知方法
- アプリ内通知（リアルタイム）
- メール通知
- プッシュ通知（オプション）

## 7. エラーハンドリング

### 7.1 想定エラーケース
- 支払い失敗（カード無効、残高不足）
- Stripe API エラー
- ネットワークエラー
- 重複課金防止
- 不正なステータス遷移

### 7.2 リトライポリシー
- 支払い失敗: 3日間、1日1回リトライ
- API エラー: 指数バックオフで5回まで
- その他: ユーザーに通知して手動対応を促す

## 8. セキュリティ要件

### 8.1 データ保護
- カード情報は保存しない（Stripe Token使用）
- 支払い情報の暗号化
- PCI DSS準拠

### 8.2 不正防止
- 重複トライアル防止（デバイスID、IPアドレス）
- 異常な解約・再登録パターンの検知
- レート制限

## 9. 分析・レポート

### 9.1 KPI
- トライアル開始率
- トライアル→有料転換率
- 解約率（チャーンレート）
- LTV（顧客生涯価値）
- 月次経常収益（MRR）

### 9.2 ダッシュボード
- リアルタイムサブスクリプション状況
- コホート分析
- 収益予測
- 解約理由分析

## 10. テスト計画

### 10.1 単体テスト
- トライアル期間計算ロジック
- サブスクリプションステータス判定
- 決済フロー

### 10.2 統合テスト
- 新規登録→トライアル→有料転換フロー
- 解約→再登録フロー
- 支払い失敗→リトライフロー

### 10.3 E2Eテスト
- ユーザージャーニー全体
- エッジケース（月末、うるう年など）

## 11. 実装優先順位

### Phase 1（MVP）
1. トライアル機能の基本実装
2. ログイン時ポップアップ
3. マイページでのステータス表示

### Phase 2（決済連携）
1. Stripe統合
2. 有料会員登録フロー
3. 解約フロー

### Phase 3（運用最適化）
1. 自動更新処理
2. 通知システム
3. 分析ダッシュボード

## 12. 今後の拡張案

- 年間プラン（20%割引）
- 学生割引
- 紹介プログラム
- 段階的な機能制限（Bronze/Silver/Gold）
- 休止機能（最大3ヶ月）
- グループ割引