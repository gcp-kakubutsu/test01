const admin = require('firebase-admin');
const serviceAccount = require('../nukune-e72e97115cbd.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * デフォルトサブスクリプションデータの定義
 */
const DEFAULT_SUBSCRIPTION_DATA = {
  // 新しいサブスクリプション基本情報
  subscriptionBasic: {
    planType: 'free',
    status: 'none',
    startDate: null,
    endDate: null,
    autoRenew: false,
    trialEndDate: null
  },
  
  // サブスクリプション管理情報（初期値はnull）
  subscriptionManagement: null,
  subscriptionSchedule: null,
  
  // キャンセル情報
  cancellation: {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    refundAmount: null,
    refundStatus: null
  },
  
  // 後方互換性のために既存フィールドも設定（空の値）
  trial: {
    startDate: null,
    endDate: null,
    isActive: false,
    hasUsed: false,
    source: undefined
  },
  
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
  },
  
  // 新しい便利フィールド
  hasActiveSubscription: false,
  canAccessPremiumFeatures: false,
  subscriptionExpiresAt: null,
  daysUntilExpiry: null
};

/**
 * 4種類の料金プランデータの定義
 */
const SUBSCRIPTION_PLANS = [
  {
    id: 'plan_free',
    name: '無料プラン',
    description: '基本機能をお試しいただけます',
    planType: 'free',
    amount: 0,
    currency: 'JPY',
    billingCycle: 'one_time',
    trialDays: 0,
    features: [
      '基本的なマッチング機能',
      '1日5件まで「いいね」',
      'メッセージ機能（制限あり）'
    ],
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'plan_1month',
    name: '1ヶ月プラン',
    description: '1ヶ月間すべての機能をご利用いただけます',
    planType: '1month',
    amount: 2980,
    currency: 'JPY',
    billingCycle: 'monthly',
    trialDays: 7,
    features: [
      '無制限「いいね」',
      '無制限メッセージ',
      '相手の既読確認',
      'プロフィール優先表示',
      'マッチング分析機能'
    ],
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'plan_3month',
    name: '3ヶ月プラン',
    description: '3ヶ月間お得にご利用いただけます（20%オフ）',
    planType: '3month',
    amount: 7152, // 2980 * 3 * 0.8 = 7152
    currency: 'JPY',
    billingCycle: 'quarterly',
    trialDays: 7,
    features: [
      '無制限「いいね」',
      '無制限メッセージ',
      '相手の既読確認',
      'プロフィール優先表示',
      'マッチング分析機能',
      '20%割引適用'
    ],
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'plan_6month',
    name: '6ヶ月プラン',
    description: '6ヶ月間大変お得にご利用いただけます（30%オフ）',
    planType: '6month',
    amount: 12516, // 2980 * 6 * 0.7 = 12516
    currency: 'JPY',
    billingCycle: 'semiannual',
    trialDays: 14,
    features: [
      '無制限「いいね」',
      '無制限メッセージ',
      '相手の既読確認',
      'プロフィール優先表示',
      'マッチング分析機能',
      '30%割引適用',
      '14日間無料トライアル'
    ],
    isActive: true,
    sortOrder: 4
  },
  {
    id: 'plan_12month',
    name: '12ヶ月プラン',
    description: '12ヶ月間最もお得にご利用いただけます（40%オフ）',
    planType: '12month',
    amount: 21456, // 2980 * 12 * 0.6 = 21456
    currency: 'JPY',
    billingCycle: 'annual',
    trialDays: 30,
    features: [
      '無制限「いいね」',
      '無制限メッセージ',
      '相手の既読確認',
      'プロフィール優先表示',
      'マッチング分析機能',
      '40%割引適用',
      '30日間無料トライアル',
      '優先サポート'
    ],
    isActive: true,
    sortOrder: 5
  }
];

/**
 * 既存ユーザーデータの取得
 */
async function getAllUsers() {
  console.log('🔍 既存ユーザーデータを取得中...');
  
  const usersSnapshot = await db.collection('users').get();
  const users = [];
  
  usersSnapshot.forEach(doc => {
    users.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  console.log(`✅ ${users.length}件のユーザーデータを取得しました`);
  return users;
}

/**
 * 移行済みチェック処理
 */
function isUserMigrated(userData) {
  // subscriptionBasicフィールドがあれば移行済み
  return userData.subscriptionBasic !== undefined;
}

/**
 * 料金プランデータの作成
 */
async function createPlans() {
  console.log('📋 料金プランデータを作成中...');
  
  let createdCount = 0;
  let skippedCount = 0;
  
  for (const plan of SUBSCRIPTION_PLANS) {
    try {
      const planRef = db.collection('plans').doc(plan.id);
      const planDoc = await planRef.get();
      
      if (planDoc.exists) {
        console.log(`⏭️  プラン ${plan.name} は既に存在しています`);
        skippedCount++;
        continue;
      }
      
      const planData = {
        ...plan,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await planRef.set(planData);
      console.log(`✅ プラン ${plan.name} を作成しました`);
      createdCount++;
      
    } catch (error) {
      console.error(`❌ プラン ${plan.name} の作成に失敗:`, error.message);
      throw error;
    }
  }
  
  console.log(`📋 料金プラン作成完了: ${createdCount}件作成、${skippedCount}件スキップ`);
}

/**
 * ユーザーデータの移行処理
 */
async function migrateUserData(users) {
  console.log('👥 ユーザーデータを移行中...');
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // バッチサイズ
  const batchSize = 100;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = db.batch();
    const batchUsers = users.slice(i, i + batchSize);
    let batchHasUpdates = false;
    
    for (const user of batchUsers) {
      try {
        // 移行済みチェック
        if (isUserMigrated(user.data)) {
          console.log(`⏭️  ユーザー ${user.id} は既に移行済みです`);
          skippedCount++;
          continue;
        }
        
        // 既存のisPremium状態を保持
        const isPremium = user.data.isPremium || false;
        
        // 既存のサブスクリプション情報があれば保持
        const existingSubscriptionEndDate = user.data.subscriptionEndDate;
        const hasExistingSubscription = existingSubscriptionEndDate && isPremium;
        
        // デフォルトデータを準備
        let migrationData = { ...DEFAULT_SUBSCRIPTION_DATA };
        
        // 既存の有料ユーザーの場合は情報を移行
        if (hasExistingSubscription) {
          const now = admin.firestore.Timestamp.now();
          const endDate = existingSubscriptionEndDate;
          const isExpired = endDate.toDate() < now.toDate();
          
          migrationData.subscriptionBasic = {
            planType: user.data.subscriptionPlan || '12month',
            status: isExpired ? 'expired' : 'active',
            startDate: user.data.subscriptionStartDate || now,
            endDate: endDate,
            autoRenew: false,
            trialEndDate: null
          };
          
          migrationData.subscription = {
            status: isExpired ? 'expired' : 'active',
            currentPeriodStart: user.data.subscriptionStartDate || now,
            currentPeriodEnd: endDate,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            pausedAt: null
          };
          
          migrationData.hasActiveSubscription = !isExpired;
          migrationData.canAccessPremiumFeatures = !isExpired;
          migrationData.subscriptionExpiresAt = endDate;
          
          if (!isExpired) {
            const daysUntilExpiry = Math.ceil((endDate.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
            migrationData.daysUntilExpiry = daysUntilExpiry;
          }
        }
        
        // 更新データを作成（既存フィールドは保持）
        const updateData = {
          ...migrationData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const userRef = db.collection('users').doc(user.id);
        batch.update(userRef, updateData);
        batchHasUpdates = true;
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ ユーザー ${user.id} の移行に失敗:`, error.message);
        errorCount++;
      }
    }
    
    // バッチに更新があれば実行
    if (batchHasUpdates) {
      try {
        await batch.commit();
        console.log(`✅ バッチ ${Math.floor(i / batchSize) + 1} (${batchUsers.length}件) を処理しました`);
      } catch (error) {
        console.error(`❌ バッチ ${Math.floor(i / batchSize) + 1} の実行に失敗:`, error.message);
        errorCount += batchUsers.length;
      }
    }
  }
  
  console.log(`👥 ユーザーデータ移行完了: ${migratedCount}件移行、${skippedCount}件スキップ、${errorCount}件エラー`);
  
  if (errorCount > 0) {
    throw new Error(`${errorCount}件のユーザーデータ移行に失敗しました`);
  }
}

/**
 * メイン移行処理
 */
async function runMigration() {
  const startTime = Date.now();
  console.log('🚀 サブスクリプションデータ移行を開始します...');
  console.log(`開始時刻: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  try {
    // 1. 料金プランデータの作成
    await createPlans();
    console.log('');
    
    // 2. 既存ユーザーデータの取得
    const users = await getAllUsers();
    console.log('');
    
    // 3. ユーザーデータの移行
    if (users.length > 0) {
      await migrateUserData(users);
    } else {
      console.log('📝 移行対象のユーザーがありません');
    }
    
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ サブスクリプションデータ移行が正常に完了しました！');
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`⏱️  実行時間: ${duration}秒`);
    console.log(`終了時刻: ${new Date().toISOString()}`);
    
    process.exit(0);
    
  } catch (error) {
    console.log('');
    console.log('='.repeat(50));
    console.error('❌ 移行処理中にエラーが発生しました:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('スタックトレース:');
      console.error(error.stack);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`⏱️  実行時間: ${duration}秒`);
    console.log(`終了時刻: ${new Date().toISOString()}`);
    
    process.exit(1);
  }
}

// 実行確認
if (process.argv.includes('--confirm')) {
  // --confirmフラグがある場合のみ実行
  runMigration();
} else {
  console.log('⚠️  サブスクリプションデータ移行スクリプト');
  console.log('');
  console.log('このスクリプトは以下の処理を行います:');
  console.log('1. plansコレクションに5種類の料金プランを作成');
  console.log('2. 既存全ユーザーにサブスクリプション関連フィールドを追加');
  console.log('3. 既存の有料ユーザー情報を新しい形式に移行');
  console.log('');
  console.log('⚠️  本番環境での実行前にバックアップを取得してください');
  console.log('');
  console.log('実行するには --confirm フラグを追加してください:');
  console.log('node scripts/migrate-subscription-data.js --confirm');
  console.log('');
  process.exit(0);
}