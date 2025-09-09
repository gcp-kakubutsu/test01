#!/usr/bin/env node

/**
 * @file usersコレクション全削除スクリプト
 * @description
 * - Firestoreの `users` コレクションを安全に削除します。
 * - ドライラン（--dry-run）で削除対象件数の確認が可能です。
 * - 任意で再帰削除（--recursive）により各ユーザードキュメント直下のサブコレクションも削除します。
 *
 * 主な仕様:
 * - 引数:
 *   --execute: 実際に削除を実行（省略時はドライラン）
 *   --dry-run: ドライラン（デフォルト）
 *   --recursive: サブコレクションも削除（深さは再帰的に全て）
 *   --batch-size=N: バッチ削除サイズ（1〜500、既定300）
 * - バッチ削除を用いてFirestoreの制限（1バッチ最大500オペレーション）に収まるよう制御
 * - 並び順は `__name__`（ドキュメントID）でページングしながら順次削除
 *
 * 制限事項:
 * - ドキュメント数/サブコレクション数が非常に多い場合、実行時間が長くなります。
 * - ネットワーク障害時は再実行が必要になる場合があります（処理は冪等）。
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 引数解析
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isDryRun = args.includes('--dry-run') || !isExecute;
const isRecursive = args.includes('--recursive');
const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? Math.min(500, Math.max(1, parseInt(batchSizeArg.split('=')[1], 10) || 300)) : 300;

// Firebase Admin 初期化
let app;
try {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase configuration. Require FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    }

    // 改行の復元
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: '',
      private_key: privateKey,
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
const { FieldPath } = admin.firestore;

/**
 * ログ: 情報
 * @param {string} message - メッセージ
 */
function logInfo(message) {
  console.log(`ℹ️  [${new Date().toISOString()}] ${message}`);
}

/**
 * ログ: 成功
 * @param {string} message - メッセージ
 */
function logSuccess(message) {
  console.log(`✅ [${new Date().toISOString()}] ${message}`);
}

/**
 * ログ: 警告
 * @param {string} message - メッセージ
 */
function logWarning(message) {
  console.log(`⚠️  [${new Date().toISOString()}] ${message}`);
}

/**
 * ログ: エラー
 * @param {string} message - メッセージ
 */
function logError(message) {
  console.error(`❌ [${new Date().toISOString()}] ${message}`);
}

/**
 * 指定コレクションのサブコレクションを再帰的に削除
 * @param {FirebaseFirestore.DocumentReference} docRef - ドキュメント参照
 * @param {number} batchLimit - バッチサイズ
 * @returns {Promise<number>} 削除されたドキュメント数
 */
async function deleteSubcollectionsRecursively(docRef, batchLimit) {
  let deletedCount = 0;
  const collections = await docRef.listCollections();
  for (const subCol of collections) {
    // subCol の全ドキュメントをページングしながら取得
    let lastDoc = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = subCol.orderBy(FieldPath.documentId()).limit(batchLimit);
      if (lastDoc) {
        query = query.startAfter(lastDoc.id);
      }
      const snap = await query.get();
      if (snap.empty) break;

      // サブサブコレクションも削除（再帰）
      for (const d of snap.docs) {
        await deleteSubcollectionsRecursively(d.ref, batchLimit);
      }

      // バッチで削除
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deletedCount += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
    }
  }
  return deletedCount;
}

/**
 * usersコレクションを削除
 * @param {boolean} dryRun - ドライラン
 * @param {boolean} recursive - サブコレクションも削除
 * @param {number} limit - バッチサイズ
 * @returns {Promise<{deletedUsers:number, deletedSubDocs:number}>} 結果
 */
async function deleteUsersCollection(dryRun, recursive, limit) {
  let deletedUsers = 0;
  let deletedSubDocs = 0;
  let totalUsersCount = 0;

  // 件数の把握
  try {
    const countSnap = await db.collection('users').get();
    totalUsersCount = countSnap.size;
  } catch (e) {
    // ignore counting errors and proceed with streaming deletion
  }

  logInfo(`Starting deletion: users (total approx: ${totalUsersCount || 'unknown'}) | recursive=${recursive} | dryRun=${dryRun} | batchSize=${limit}`);

  let lastDoc = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db.collection('users').orderBy(FieldPath.documentId()).limit(limit);
    if (lastDoc) {
      query = query.startAfter(lastDoc.id);
    }
    const snap = await query.get();
    if (snap.empty) break;

    if (dryRun) {
      // ドライラン: 対象IDのみ表示
      snap.docs.forEach(d => logInfo(`[DRY RUN] Would delete user: ${d.id}`));
      deletedUsers += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      continue;
    }

    // 実削除
    for (const doc of snap.docs) {
      try {
        // サブコレクションの再帰削除（必要な場合）
        if (recursive) {
          const subDeleted = await deleteSubcollectionsRecursively(doc.ref, limit);
          if (subDeleted > 0) {
            logInfo(`Deleted ${subDeleted} subcollection docs under user ${doc.id}`);
            deletedSubDocs += subDeleted;
          }
        }

        // ドキュメント自体を削除
        await doc.ref.delete();
        deletedUsers++;
        logInfo(`Deleted user: ${doc.id}`);
      } catch (err) {
        logError(`Failed to delete user ${doc.id}: ${err && err.message ? err.message : String(err)}`);
      }
    }
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { deletedUsers, deletedSubDocs };
}

/**
 * メイン
 */
async function main() {
  try {
    console.log('🗑️  Delete Users Collection');
    console.log('============================');
    logWarning('この操作は不可逆です。必要な場合は事前にバックアップを取得してください。');
    logInfo(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTION'}`);
    logInfo(`Recursive: ${isRecursive}`);
    logInfo(`Batch size: ${batchSize}`);

    const { deletedUsers, deletedSubDocs } = await deleteUsersCollection(isDryRun, isRecursive, batchSize);

    console.log('\n📊 Result');
    console.log('========');
    console.log(`Users targeted: ${deletedUsers}`);
    if (!isDryRun) {
      console.log(`Subcollection docs deleted: ${deletedSubDocs}`);
    }

    if (isDryRun) {
      logSuccess('Dry run completed. No changes were made.');
    } else {
      logSuccess('Deletion completed.');
    }

    process.exit(0);
  } catch (error) {
    logError(`Script failed: ${error && error.message ? error.message : String(error)}`);
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  } finally {
    if (app) {
      try {
        await admin.app().delete();
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  deleteUsersCollection,
  deleteSubcollectionsRecursively
};


