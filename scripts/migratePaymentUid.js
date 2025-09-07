#!/usr/bin/env node

/**
 * 既存ユーザーへのpayment_uid一括移行スクリプト
 * 
 * 使用方法:
 * node scripts/migratePaymentUid.js --dry-run  # ドライラン（実際の変更なし）
 * node scripts/migratePaymentUid.js --execute  # 実際の移行を実行
 * node scripts/migratePaymentUid.js --batch-size=50 --execute  # バッチサイズ指定
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// コマンドライン引数を解析
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 10;

// Firebase Admin SDK初期化
let app;
try {
  if (admin.apps.length === 0) {
    const serviceAccountKey = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (!serviceAccountKey || !projectId) {
      throw new Error('Missing Firebase configuration. Please check your environment variables.');
    }
    
    const serviceAccount = JSON.parse(serviceAccountKey);
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    app = admin.apps[0];
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Payment UID生成関数（16桁の英数字）
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYMENT_UID_LENGTH = 16;
const MAX_RETRIES = 10;

function generatePaymentUid() {
  let result = '';
  for (let i = 0; i < PAYMENT_UID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[randomIndex];
  }
  return result;
}

async function checkPaymentUidUnique(paymentUid) {
  try {
    const querySnapshot = await db.collection('users')
      .where('payment_uid', '==', paymentUid)
      .limit(1)
      .get();
    
    return querySnapshot.empty;
  } catch (error) {
    throw new Error(`Failed to check uniqueness: ${error.message}`);
  }
}

async function generateUniquePaymentUid(maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const paymentUid = generatePaymentUid();
    const isUnique = await checkPaymentUidUnique(paymentUid);
    
    if (isUnique) {
      return paymentUid;
    }
    
    console.log(`⚠️ payment_uid ${paymentUid} is not unique, retrying... (${attempt}/${maxRetries})`);
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
  
  throw new Error(`Failed to generate unique payment_uid after ${maxRetries} attempts`);
}

// 移行結果の統計
class MigrationStats {
  constructor() {
    this.totalUsers = 0;
    this.usersWithPaymentUid = 0;
    this.usersToMigrate = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.errors = [];
    this.startTime = Date.now();
    this.batchCount = 0;
  }

  addError(userId, error) {
    this.failureCount++;
    this.errors.push({
      userId,
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  }

  addSuccess() {
    this.successCount++;
  }

  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  getSummary() {
    const elapsedSeconds = Math.round(this.getElapsedTime() / 1000);
    return {
      totalUsers: this.totalUsers,
      usersWithPaymentUid: this.usersWithPaymentUid,
      usersToMigrate: this.usersToMigrate,
      successCount: this.successCount,
      failureCount: this.failureCount,
      errorCount: this.errors.length,
      batchCount: this.batchCount,
      elapsedTimeSeconds: elapsedSeconds,
      successRate: this.usersToMigrate > 0 ? Math.round((this.successCount / this.usersToMigrate) * 100) : 0
    };
  }
}

// ログ出力ヘルパー
function logInfo(message) {
  console.log(`ℹ️  [${new Date().toISOString()}] ${message}`);
}

function logSuccess(message) {
  console.log(`✅ [${new Date().toISOString()}] ${message}`);
}

function logWarning(message) {
  console.log(`⚠️  [${new Date().toISOString()}] ${message}`);
}

function logError(message) {
  console.error(`❌ [${new Date().toISOString()}] ${message}`);
}

// 既存ユーザー数を確認
async function countUsers() {
  try {
    logInfo('Counting existing users...');
    
    const allUsersSnapshot = await db.collection('users').get();
    const totalUsers = allUsersSnapshot.size;
    
    const usersWithPaymentUidSnapshot = await db.collection('users')
      .where('payment_uid', '!=', null)
      .get();
    const usersWithPaymentUid = usersWithPaymentUidSnapshot.size;
    
    const usersToMigrate = totalUsers - usersWithPaymentUid;
    
    logInfo(`Total users: ${totalUsers}`);
    logInfo(`Users with payment_uid: ${usersWithPaymentUid}`);
    logInfo(`Users to migrate: ${usersToMigrate}`);
    
    return { totalUsers, usersWithPaymentUid, usersToMigrate };
  } catch (error) {
    logError(`Failed to count users: ${error.message}`);
    throw error;
  }
}

// ユーザーを移行
async function migrateUsers(isDryRun = false, batchSize = 10) {
  const stats = new MigrationStats();
  
  try {
    // ユーザー数をカウント
    const userCounts = await countUsers();
    stats.totalUsers = userCounts.totalUsers;
    stats.usersWithPaymentUid = userCounts.usersWithPaymentUid;
    stats.usersToMigrate = userCounts.usersToMigrate;
    
    if (stats.usersToMigrate === 0) {
      logSuccess('All users already have payment_uid. Migration not needed.');
      return stats;
    }
    
    logInfo(`Starting migration of ${stats.usersToMigrate} users (batch size: ${batchSize})`);
    
    if (isDryRun) {
      logWarning('DRY RUN MODE - No actual changes will be made');
    }
    
    // payment_uidを持たないユーザーを取得
    const usersToMigrateSnapshot = await db.collection('users').get();
    const usersWithoutPaymentUid = [];
    
    usersToMigrateSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.payment_uid) {
        usersWithoutPaymentUid.push({ id: doc.id, data: userData });
      }
    });
    
    logInfo(`Found ${usersWithoutPaymentUid.length} users without payment_uid`);
    
    // バッチ処理で移行
    for (let i = 0; i < usersWithoutPaymentUid.length; i += batchSize) {
      const currentBatch = usersWithoutPaymentUid.slice(i, i + batchSize);
      stats.batchCount++;
      
      logInfo(`Processing batch ${stats.batchCount}: users ${i + 1}-${Math.min(i + batchSize, usersWithoutPaymentUid.length)}`);
      
      if (!isDryRun) {
        // Firestore batch write
        const batch = db.batch();
        const batchPaymentUids = [];
        
        // 各ユーザーにpayment_uidを生成
        for (const user of currentBatch) {
          try {
            const paymentUid = await generateUniquePaymentUid();
            batchPaymentUids.push({ userId: user.id, paymentUid });
            
            const userRef = db.collection('users').doc(user.id);
            batch.update(userRef, {
              payment_uid: paymentUid,
              payment_uid_created_at: admin.firestore.FieldValue.serverTimestamp(),
              payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            logInfo(`Prepared payment_uid for user ${user.id}: ${paymentUid}`);
          } catch (error) {
            logError(`Failed to generate payment_uid for user ${user.id}: ${error.message}`);
            stats.addError(user.id, error);
          }
        }
        
        // バッチをコミット
        try {
          await batch.commit();
          
          const successfulInBatch = batchPaymentUids.length;
          stats.successCount += successfulInBatch;
          
          logSuccess(`Successfully processed batch ${stats.batchCount}: ${successfulInBatch}/${currentBatch.length} users`);
          
          // 処理したpayment_uidをログに記録
          batchPaymentUids.forEach(({ userId, paymentUid }) => {
            logInfo(`✓ User ${userId}: ${paymentUid}`);
          });
          
        } catch (error) {
          logError(`Batch commit failed for batch ${stats.batchCount}: ${error.message}`);
          
          // バッチ内の全ユーザーをエラーとして記録
          currentBatch.forEach(user => {
            stats.addError(user.id, new Error(`Batch commit failed: ${error.message}`));
          });
        }
        
        // 短時間待機（Firestoreの負荷軽減）
        if (i + batchSize < usersWithoutPaymentUid.length) {
          logInfo('Waiting 1 second before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } else {
        // ドライラン - 実際の処理はしない
        for (const user of currentBatch) {
          try {
            const paymentUid = await generateUniquePaymentUid();
            stats.successCount++;
            logInfo(`[DRY RUN] Would assign payment_uid to user ${user.id}: ${paymentUid}`);
          } catch (error) {
            stats.addError(user.id, error);
            logError(`[DRY RUN] Failed to generate payment_uid for user ${user.id}: ${error.message}`);
          }
        }
      }
    }
    
    return stats;
    
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    throw error;
  }
}

// 移行結果の検証
async function verifyMigration() {
  try {
    logInfo('Verifying migration results...');
    
    const userCounts = await countUsers();
    
    if (userCounts.usersToMigrate === 0) {
      logSuccess('✓ Verification passed: All users have payment_uid');
      return true;
    } else {
      logError(`✗ Verification failed: ${userCounts.usersToMigrate} users still without payment_uid`);
      return false;
    }
  } catch (error) {
    logError(`Verification failed: ${error.message}`);
    return false;
  }
}

// レポート出力
function generateReport(stats) {
  const summary = stats.getSummary();
  
  console.log('\n📊 Migration Report');
  console.log('==================');
  console.log(`Total users: ${summary.totalUsers}`);
  console.log(`Users with existing payment_uid: ${summary.usersWithPaymentUid}`);
  console.log(`Users to migrate: ${summary.usersToMigrate}`);
  console.log(`Successful migrations: ${summary.successCount}`);
  console.log(`Failed migrations: ${summary.failureCount}`);
  console.log(`Success rate: ${summary.successRate}%`);
  console.log(`Batches processed: ${summary.batchCount}`);
  console.log(`Elapsed time: ${summary.elapsedTimeSeconds} seconds`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach((error, index) => {
      console.log(`${index + 1}. User ${error.userId}: ${error.error}`);
    });
  }
  
  console.log('\n');
}

// メイン実行関数
async function main() {
  try {
    console.log('🚀 Payment UID Migration Script');
    console.log('================================');
    
    // コマンドライン引数の検証
    if (!isDryRun && !isExecute) {
      console.log('Usage:');
      console.log('  node scripts/migratePaymentUid.js --dry-run   # Preview changes');
      console.log('  node scripts/migratePaymentUid.js --execute   # Execute migration');
      console.log('  node scripts/migratePaymentUid.js --batch-size=50 --execute  # Custom batch size');
      process.exit(1);
    }
    
    if (batchSize < 1 || batchSize > 100) {
      logError('Batch size must be between 1 and 100');
      process.exit(1);
    }
    
    logInfo(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTION'}`);
    logInfo(`Batch size: ${batchSize}`);
    
    // 移行実行
    const stats = await migrateUsers(isDryRun, batchSize);
    
    // レポート生成
    generateReport(stats);
    
    // 実際の移行後は検証を実行
    if (!isDryRun && stats.successCount > 0) {
      await verifyMigration();
    }
    
    const summary = stats.getSummary();
    if (summary.failureCount === 0) {
      logSuccess('Migration completed successfully!');
      process.exit(0);
    } else {
      logWarning(`Migration completed with ${summary.failureCount} errors. Check the report above.`);
      process.exit(summary.failureCount > summary.successCount ? 1 : 0);
    }
    
  } catch (error) {
    logError(`Migration script failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Firebase Admin app を適切にクリーンアップ
    if (app) {
      try {
        await admin.app().delete();
      } catch (error) {
        // クリーンアップエラーは無視
      }
    }
  }
}

// 未処理のエラーをキャッチ
process.on('unhandledRejection', (error) => {
  logError(`Unhandled promise rejection: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = {
  migrateUsers,
  verifyMigration,
  generatePaymentUid,
  checkPaymentUidUnique,
  generateUniquePaymentUid
};