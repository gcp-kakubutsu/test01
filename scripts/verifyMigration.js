#!/usr/bin/env node

/**
 * payment_uid移行結果検証スクリプト
 * 
 * 使用方法:
 * node scripts/verifyMigration.js              # 基本的な検証
 * node scripts/verifyMigration.js --detailed   # 詳細な検証とレポート
 * node scripts/verifyMigration.js --fix        # 問題の自動修正を試行
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// コマンドライン引数を解析
const args = process.argv.slice(2);
const isDetailed = args.includes('--detailed');
const shouldFix = args.includes('--fix');

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

// 検証結果の統計
class VerificationStats {
  constructor() {
    this.totalUsers = 0;
    this.usersWithPaymentUid = 0;
    this.usersWithoutPaymentUid = 0;
    this.validPaymentUids = 0;
    this.invalidPaymentUids = 0;
    this.duplicatePaymentUids = 0;
    this.issues = [];
    this.fixedIssues = [];
    this.startTime = Date.now();
  }

  addIssue(type, userId, paymentUid, description) {
    this.issues.push({
      type,
      userId,
      paymentUid,
      description,
      timestamp: new Date().toISOString()
    });
  }

  addFixedIssue(type, userId, paymentUid, description) {
    this.fixedIssues.push({
      type,
      userId,
      paymentUid,
      description,
      timestamp: new Date().toISOString()
    });
  }

  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  getSummary() {
    const elapsedSeconds = Math.round(this.getElapsedTime() / 1000);
    return {
      totalUsers: this.totalUsers,
      usersWithPaymentUid: this.usersWithPaymentUid,
      usersWithoutPaymentUid: this.usersWithoutPaymentUid,
      validPaymentUids: this.validPaymentUids,
      invalidPaymentUids: this.invalidPaymentUids,
      duplicatePaymentUids: this.duplicatePaymentUids,
      issuesFound: this.issues.length,
      issuesFixed: this.fixedIssues.length,
      elapsedTimeSeconds: elapsedSeconds,
      completionRate: this.totalUsers > 0 ? Math.round((this.usersWithPaymentUid / this.totalUsers) * 100) : 0,
      validationRate: this.usersWithPaymentUid > 0 ? Math.round((this.validPaymentUids / this.usersWithPaymentUid) * 100) : 0
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

// payment_uidのフォーマット検証
function validatePaymentUidFormat(paymentUid) {
  if (!paymentUid) return false;
  if (typeof paymentUid !== 'string') return false;
  if (paymentUid.length !== 16) return false;
  if (!/^[A-Za-z0-9]+$/.test(paymentUid)) return false;
  return true;
}

// payment_uid生成関数（修正用）
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYMENT_UID_LENGTH = 16;

function generatePaymentUid() {
  let result = '';
  for (let i = 0; i < PAYMENT_UID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[randomIndex];
  }
  return result;
}

// 基本的な検証
async function performBasicVerification() {
  const stats = new VerificationStats();
  
  try {
    logInfo('Starting basic verification...');
    
    // 全ユーザーを取得
    const usersSnapshot = await db.collection('users').get();
    stats.totalUsers = usersSnapshot.size;
    
    logInfo(`Total users found: ${stats.totalUsers}`);
    
    // payment_uidの有無をチェック
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const userId = doc.id;
      
      if (userData.payment_uid) {
        stats.usersWithPaymentUid++;
        
        // フォーマット検証
        if (validatePaymentUidFormat(userData.payment_uid)) {
          stats.validPaymentUids++;
        } else {
          stats.invalidPaymentUids++;
          stats.addIssue('invalid_format', userId, userData.payment_uid, 
            `Invalid payment_uid format: ${userData.payment_uid}`);
        }
      } else {
        stats.usersWithoutPaymentUid++;
        stats.addIssue('missing_payment_uid', userId, null, 'User does not have payment_uid');
      }
    });
    
    return stats;
  } catch (error) {
    logError(`Basic verification failed: ${error.message}`);
    throw error;
  }
}

// 詳細な検証
async function performDetailedVerification(stats) {
  try {
    logInfo('Starting detailed verification...');
    
    // 重複チェック
    const paymentUidMap = new Map();
    const usersSnapshot = await db.collection('users').get();
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const userId = doc.id;
      
      if (userData.payment_uid) {
        if (paymentUidMap.has(userData.payment_uid)) {
          // 重複発見
          const existingUserId = paymentUidMap.get(userData.payment_uid);
          stats.duplicatePaymentUids++;
          stats.addIssue('duplicate_payment_uid', userId, userData.payment_uid,
            `Duplicate payment_uid found. Also used by user: ${existingUserId}`);
        } else {
          paymentUidMap.set(userData.payment_uid, userId);
        }
        
        // タイムスタンプの存在チェック
        if (!userData.payment_uid_created_at) {
          stats.addIssue('missing_created_at', userId, userData.payment_uid,
            'Missing payment_uid_created_at timestamp');
        }
        
        if (!userData.payment_uid_updated_at) {
          stats.addIssue('missing_updated_at', userId, userData.payment_uid,
            'Missing payment_uid_updated_at timestamp');
        }
        
        // タイムスタンプの一貫性チェック
        if (userData.payment_uid_created_at && userData.payment_uid_updated_at) {
          const createdAt = userData.payment_uid_created_at.toDate ? userData.payment_uid_created_at.toDate() : new Date(userData.payment_uid_created_at);
          const updatedAt = userData.payment_uid_updated_at.toDate ? userData.payment_uid_updated_at.toDate() : new Date(userData.payment_uid_updated_at);
          
          if (createdAt > updatedAt) {
            stats.addIssue('timestamp_inconsistency', userId, userData.payment_uid,
              'payment_uid_created_at is after payment_uid_updated_at');
          }
        }
      }
    });
    
    logInfo(`Duplicate payment_uids found: ${stats.duplicatePaymentUids}`);
    
  } catch (error) {
    logError(`Detailed verification failed: ${error.message}`);
    throw error;
  }
}

// 問題の自動修正
async function fixIssues(stats) {
  if (!shouldFix) {
    return;
  }
  
  try {
    logInfo('Starting automatic issue fixing...');
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const issue of stats.issues) {
      if (batchCount >= 500) {
        // Firestoreのバッチ制限（500操作）に達した場合、コミットして新しいバッチを開始
        await batch.commit();
        logInfo(`Committed batch with ${batchCount} operations`);
        batchCount = 0;
      }
      
      const userRef = db.collection('users').doc(issue.userId);
      
      switch (issue.type) {
        case 'missing_payment_uid':
          try {
            const newPaymentUid = generatePaymentUid();
            batch.update(userRef, {
              payment_uid: newPaymentUid,
              payment_uid_created_at: admin.firestore.FieldValue.serverTimestamp(),
              payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            stats.addFixedIssue(issue.type, issue.userId, newPaymentUid,
              `Generated new payment_uid: ${newPaymentUid}`);
            batchCount++;
          } catch (error) {
            logError(`Failed to generate payment_uid for user ${issue.userId}: ${error.message}`);
          }
          break;
          
        case 'invalid_format':
          try {
            const newPaymentUid = generatePaymentUid();
            batch.update(userRef, {
              payment_uid: newPaymentUid,
              payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            stats.addFixedIssue(issue.type, issue.userId, newPaymentUid,
              `Replaced invalid payment_uid ${issue.paymentUid} with ${newPaymentUid}`);
            batchCount++;
          } catch (error) {
            logError(`Failed to fix invalid payment_uid for user ${issue.userId}: ${error.message}`);
          }
          break;
          
        case 'missing_created_at':
          batch.update(userRef, {
            payment_uid_created_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          stats.addFixedIssue(issue.type, issue.userId, issue.paymentUid,
            'Added missing payment_uid_created_at timestamp');
          batchCount++;
          break;
          
        case 'missing_updated_at':
          batch.update(userRef, {
            payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          stats.addFixedIssue(issue.type, issue.userId, issue.paymentUid,
            'Added missing payment_uid_updated_at timestamp');
          batchCount++;
          break;
          
        case 'duplicate_payment_uid':
          // 重複の場合は新しいpayment_uidを生成
          try {
            const newPaymentUid = generatePaymentUid();
            batch.update(userRef, {
              payment_uid: newPaymentUid,
              payment_uid_updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            stats.addFixedIssue(issue.type, issue.userId, newPaymentUid,
              `Replaced duplicate payment_uid ${issue.paymentUid} with ${newPaymentUid}`);
            batchCount++;
          } catch (error) {
            logError(`Failed to fix duplicate payment_uid for user ${issue.userId}: ${error.message}`);
          }
          break;
      }
    }
    
    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      logInfo(`Committed final batch with ${batchCount} operations`);
    }
    
    logSuccess(`Fixed ${stats.fixedIssues.length} issues`);
    
  } catch (error) {
    logError(`Issue fixing failed: ${error.message}`);
    throw error;
  }
}

// レポート生成
function generateReport(stats, isDetailed) {
  const summary = stats.getSummary();
  
  console.log('\n📊 Migration Verification Report');
  console.log('================================');
  console.log(`Total users: ${summary.totalUsers}`);
  console.log(`Users with payment_uid: ${summary.usersWithPaymentUid} (${summary.completionRate}%)`);
  console.log(`Users without payment_uid: ${summary.usersWithoutPaymentUid}`);
  console.log(`Valid payment_uids: ${summary.validPaymentUids} (${summary.validationRate}%)`);
  console.log(`Invalid payment_uids: ${summary.invalidPaymentUids}`);
  console.log(`Duplicate payment_uids: ${summary.duplicatePaymentUids}`);
  console.log(`Issues found: ${summary.issuesFound}`);
  
  if (shouldFix) {
    console.log(`Issues fixed: ${summary.issuesFixed}`);
  }
  
  console.log(`Verification time: ${summary.elapsedTimeSeconds} seconds`);
  
  // 全体的な健康度
  const healthScore = Math.round(
    ((summary.validPaymentUids / summary.totalUsers) * 100)
  );
  console.log(`Migration health score: ${healthScore}%`);
  
  if (isDetailed && stats.issues.length > 0) {
    console.log('\n❌ Issues found:');
    const issuesByType = {};
    
    stats.issues.forEach(issue => {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    });
    
    Object.keys(issuesByType).forEach(type => {
      console.log(`\n${type.toUpperCase().replace(/_/g, ' ')} (${issuesByType[type].length}):`);
      issuesByType[type].slice(0, 10).forEach((issue, index) => {
        console.log(`  ${index + 1}. User ${issue.userId}: ${issue.description}`);
      });
      if (issuesByType[type].length > 10) {
        console.log(`  ... and ${issuesByType[type].length - 10} more`);
      }
    });
  }
  
  if (shouldFix && stats.fixedIssues.length > 0) {
    console.log('\n✅ Issues fixed:');
    stats.fixedIssues.forEach((fix, index) => {
      console.log(`  ${index + 1}. User ${fix.userId}: ${fix.description}`);
    });
  }
  
  console.log('\n');
}

// 推奨事項の提示
function provideRecommendations(stats) {
  const summary = stats.getSummary();
  
  console.log('💡 Recommendations:');
  console.log('==================');
  
  if (summary.usersWithoutPaymentUid > 0) {
    console.log(`• Run migration script for ${summary.usersWithoutPaymentUid} users without payment_uid`);
  }
  
  if (summary.invalidPaymentUids > 0) {
    console.log(`• Fix ${summary.invalidPaymentUids} invalid payment_uid formats`);
  }
  
  if (summary.duplicatePaymentUids > 0) {
    console.log(`• Resolve ${summary.duplicatePaymentUids} duplicate payment_uid conflicts`);
  }
  
  if (stats.issues.some(issue => issue.type.includes('timestamp'))) {
    console.log('• Fix timestamp issues for proper audit trail');
  }
  
  if (summary.completionRate < 100) {
    console.log('• Consider running the migration script to complete the process');
  }
  
  if (summary.completionRate === 100 && summary.validationRate === 100 && stats.issues.length === 0) {
    console.log('• Migration is complete and healthy! 🎉');
  } else {
    console.log(`• Use --fix option to automatically resolve ${stats.issues.length} issues`);
  }
  
  console.log('\n');
}

// メイン実行関数
async function main() {
  try {
    console.log('🔍 Payment UID Migration Verification');
    console.log('=====================================');
    
    logInfo(`Verification mode: ${isDetailed ? 'DETAILED' : 'BASIC'}`);
    if (shouldFix) {
      logInfo('Auto-fix mode: ENABLED');
    }
    
    // 基本検証を実行
    const stats = await performBasicVerification();
    
    // 詳細検証を実行（指定された場合）
    if (isDetailed) {
      await performDetailedVerification(stats);
    }
    
    // 問題の自動修正（指定された場合）
    if (shouldFix && stats.issues.length > 0) {
      await fixIssues(stats);
    }
    
    // レポート生成
    generateReport(stats, isDetailed);
    
    // 推奨事項の提示
    provideRecommendations(stats);
    
    const summary = stats.getSummary();
    const hasIssues = summary.issuesFound > 0 && (!shouldFix || summary.issuesFixed < summary.issuesFound);
    
    if (hasIssues) {
      logWarning('Verification completed with issues. See report above.');
      process.exit(1);
    } else {
      logSuccess('Verification passed! Migration is healthy.');
      process.exit(0);
    }
    
  } catch (error) {
    logError(`Verification script failed: ${error.message}`);
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
  performBasicVerification,
  performDetailedVerification,
  fixIssues,
  validatePaymentUidFormat
};