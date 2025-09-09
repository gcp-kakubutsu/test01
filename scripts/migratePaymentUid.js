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
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

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
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase configuration. Please check your environment variables (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY).');
    }
    
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: '',
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: clientEmail,
      client_id: '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
    };
    
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

/**
 * 指定ユーザーに対して、payment_uidが未設定の場合のみ原子的に割り当てる。
 * 既存のpayment_uidがある場合は絶対に上書きせず、UIDが消える事象を防ぐ。
 * トランザクションによりチェックと更新を同一アトミック操作として実行する。
 * 
 * @param {string} userId - ユーザーのドキュメントID（Firebase UID）
 * @returns {Promise<{status: 'assigned'|'skipped', paymentUid?: string, existingPaymentUid?: string}>}
 */
async function assignPaymentUidIfMissingAtomic(userId) {
  // 先に候補UIDを生成（重複チェック込み）。実際の書き込みはトランザクション内で未設定時のみ行う
  const candidatePaymentUid = await generateUniquePaymentUid();
  const userRef = db.collection('users').doc(userId);
  
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const currentData = snap.exists ? snap.data() : null;
    
    // 既に有効なpayment_uidが存在する場合はスキップ（上書き禁止）
    if (
      currentData &&
      typeof currentData.payment_uid === 'string' &&
      currentData.payment_uid.trim() !== ''
    ) {
      return {
        status: 'skipped',
        existingPaymentUid: currentData.payment_uid
      };
    }
    
    // 未設定の場合のみ割り当て
    tx.update(userRef, {
      payment_uid: candidatePaymentUid,
      payment_uid_created_at: admin.firestore.FieldValue.serverTimestamp(),
      payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return {
      status: 'assigned',
      paymentUid: candidatePaymentUid
    };
  });
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
    const usersAlreadyWithPaymentUid = [];
    
    usersToMigrateSnapshot.forEach(doc => {
      const userData = doc.data();
      // より厳密なチェック：payment_uidが存在し、空でない文字列の場合はスキップ
      if (userData.payment_uid && typeof userData.payment_uid === 'string' && userData.payment_uid.trim() !== '') {
        usersAlreadyWithPaymentUid.push({ 
          id: doc.id, 
          paymentUid: userData.payment_uid,
          createdAt: userData.payment_uid_created_at
        });
      } else if (!userData.payment_uid || userData.payment_uid === '' || userData.payment_uid === null) {
        usersWithoutPaymentUid.push({ id: doc.id, data: userData });
      }
    });
    
    logInfo(`Found ${usersWithoutPaymentUid.length} users without payment_uid`);
    
    if (usersAlreadyWithPaymentUid.length > 0) {
      logSuccess(`${usersAlreadyWithPaymentUid.length} users already have payment_uid and will be SKIPPED:`);
      if (isDryRun) {
        usersAlreadyWithPaymentUid.slice(0, 5).forEach(user => {
          logInfo(`  ✓ ${user.id}: ${user.paymentUid}`);
        });
        if (usersAlreadyWithPaymentUid.length > 5) {
          logInfo(`  ... and ${usersAlreadyWithPaymentUid.length - 5} more`);
        }
      }
    }
    
    // バッチ処理で移行
    for (let i = 0; i < usersWithoutPaymentUid.length; i += batchSize) {
      const currentBatch = usersWithoutPaymentUid.slice(i, i + batchSize);
      stats.batchCount++;
      
      logInfo(`Processing batch ${stats.batchCount}: users ${i + 1}-${Math.min(i + batchSize, usersWithoutPaymentUid.length)}`);
      
      if (!isDryRun) {
        // 原子的な割り当て（UID消失防止のため、ユーザー毎にトランザクションで処理）
        const batchResults = [];
        for (const user of currentBatch) {
          try {
            const result = await assignPaymentUidIfMissingAtomic(user.id);
            if (result.status === 'assigned') {
              batchResults.push({ userId: user.id, paymentUid: result.paymentUid });
              logInfo(`Prepared payment_uid for user ${user.id}: ${result.paymentUid}`);
            } else {
              logWarning(`User ${user.id} already has payment_uid (${result.existingPaymentUid}), skipping`);
            }
          } catch (error) {
            logError(`Failed to assign payment_uid for user ${user.id}: ${error.message}`);
            stats.addError(user.id, error);
          }
        }

        // 成功件数の集計（トランザクション処理はコミット済）
        const successfulInBatch = batchResults.length;
        stats.successCount += successfulInBatch;
        logSuccess(`Successfully processed batch ${stats.batchCount}: ${successfulInBatch}/${currentBatch.length} users`);
        // ログ出力
        batchResults.forEach(({ userId, paymentUid }) => {
          logInfo(`✓ User ${userId}: ${paymentUid}`);
        });
        
        // 短時間待機（Firestoreの負荷軽減）
        if (i + batchSize < usersWithoutPaymentUid.length) {
          logInfo('Waiting 1 second before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } else {
        // ドライラン - 実際の処理はしない
        for (const user of currentBatch) {
          try {
            // 現在の状態のみ確認し、書き込みは行わない
            const currentDoc = await db.collection('users').doc(user.id).get();
            const currentData = currentDoc.data();
            if (
              currentData &&
              typeof currentData.payment_uid === 'string' &&
              currentData.payment_uid.trim() !== ''
            ) {
              logWarning(`[DRY RUN] User ${user.id} already has payment_uid (${currentData.payment_uid}), would skip`);
              continue;
            }
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