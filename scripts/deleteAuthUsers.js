#!/usr/bin/env node

/**
 * @file Firebase Authentication の全ユーザーを削除するスクリプト
 * @description
 * - Firebase Admin SDK を用いて Authentication の全ユーザーを削除します。
 * - デフォルトはドライランで対象ユーザーを一覧表示のみ（安全策）。
 * - --execute を付けた場合のみ実際に削除を実行します。
 * - オプションで Firestore の `users/{uid}` ドキュメントも削除可能（--also-firestore）。
 *
 * 仕様と制限:
 * - 一括取得は `listUsers` のページング（最大 1000 件/ページ）を使用します。
 * - 削除は `deleteUsers(uids)`（最大 1000 件/回）を使用し、失敗はレポートします。
 * - 非常に大量のユーザーの場合、時間がかかります（数分〜）。
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * @typedef {Object} CliOptions
 * @property {boolean} execute 実行モード（省略時はドライラン）
 * @property {boolean} alsoFirestore Firestoreのusersドキュメントも削除
 * @property {number} pageSize listUsersの取得件数（1〜1000、既定1000）
 * @property {number} pauseMs ページ間の待機ミリ秒（既定200）
 */

/**
 * 引数を解析
 * @returns {CliOptions}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const alsoFirestore = args.includes('--also-firestore');
  const pageSizeArg = args.find(a => a.startsWith('--page-size='));
  const pauseArg = args.find(a => a.startsWith('--pause-ms='));
  let pageSize = pageSizeArg ? parseInt(pageSizeArg.split('=')[1], 10) : 1000;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 1000) pageSize = 1000;
  let pauseMs = pauseArg ? parseInt(pauseArg.split('=')[1], 10) : 200;
  if (!Number.isFinite(pauseMs) || pauseMs < 0) pauseMs = 200;
  return { execute, alsoFirestore, pageSize, pauseMs };
}

/**
 * Firebase Admin 初期化
 */
function initializeFirebaseAdmin() {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase configuration. Set FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    }
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
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
    console.log('✅ Firebase Admin initialized successfully');
  }
}

/**
 * ログ出力
 */
function logInfo(message) { console.log(`ℹ️  [${new Date().toISOString()}] ${message}`); }
function logSuccess(message) { console.log(`✅ [${new Date().toISOString()}] ${message}`); }
function logWarning(message) { console.log(`⚠️  [${new Date().toISOString()}] ${message}`); }
function logError(message) { console.error(`❌ [${new Date().toISOString()}] ${message}`); }

/**
 * 指定UID配列のAuthユーザーを削除
 * @param {string[]} uids UID配列
 * @returns {Promise<{successCount:number, failureCount:number}>}
 */
async function deleteAuthUsersBatch(uids) {
  if (uids.length === 0) return { successCount: 0, failureCount: 0 };
  const res = await admin.auth().deleteUsers(uids);
  if (res.failureCount > 0) {
    res.errors.forEach(e => logError(`deleteUsers error for uid=${e.index < uids.length ? uids[e.index] : 'unknown'}: ${e.error?.message || e.toString()}`));
  }
  return { successCount: res.successCount, failureCount: res.failureCount };
}

/**
 * Firestoreの users/{uid} を削除（存在すれば）
 * @param {string} uid UID
 */
async function deleteFirestoreUserDocIfExists(uid) {
  const db = admin.firestore();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    logInfo(`Deleted Firestore users/${uid}`);
  }
}

/**
 * メイン処理
 */
async function main() {
  let appDeleted = false;
  try {
    const options = parseArgs();
    console.log('🗑️  Delete All Firebase Auth Users');
    console.log('=================================');
    logInfo(`Mode: ${options.execute ? 'EXECUTION' : 'DRY RUN'}`);
    logInfo(`Also delete Firestore users docs: ${options.alsoFirestore}`);
    logInfo(`Page size: ${options.pageSize}, Pause between pages: ${options.pauseMs}ms`);

    initializeFirebaseAdmin();

    let nextPageToken = undefined;
    let totalListed = 0;
    let totalDeleted = 0;
    let totalFailed = 0;
    let pageIndex = 0;

    do {
      pageIndex++;
      const page = await admin.auth().listUsers(options.pageSize, nextPageToken);
      const users = page.users || [];
      totalListed += users.length;
      logInfo(`Page ${pageIndex}: fetched ${users.length} user(s)`);

      const uids = users.map(u => u.uid);

      if (!options.execute) {
        uids.forEach(uid => logInfo(`[DRY RUN] Would delete auth user: ${uid}`));
      } else {
        const { successCount, failureCount } = await deleteAuthUsersBatch(uids);
        totalDeleted += successCount;
        totalFailed += failureCount;

        if (options.alsoFirestore && successCount > 0) {
          for (const uid of uids) {
            try { await deleteFirestoreUserDocIfExists(uid); } catch (e) { logError(`Failed to delete users/${uid}: ${e?.message || e}`); }
          }
        }
      }

      nextPageToken = page.pageToken;
      if (nextPageToken && options.pauseMs > 0) {
        await new Promise(r => setTimeout(r, options.pauseMs));
      }
    } while (nextPageToken);

    console.log('\n📊 Summary');
    console.log('==========');
    console.log(`Listed Auth users: ${totalListed}`);
    if (!options.execute) {
      logSuccess('Dry run completed. No users were deleted.');
    } else {
      console.log(`Deleted: ${totalDeleted}, Failed: ${totalFailed}`);
      logSuccess('Deletion completed.');
    }

    try { await admin.app().delete(); appDeleted = true; } catch { /* ignore */ }
    process.exit(0);
  } catch (error) {
    logError(`Script failed: ${error?.message || error}`);
    console.error(error?.stack || error);
    try { if (!appDeleted) await admin.app().delete(); } catch {}
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  deleteAuthUsersBatch,
  deleteFirestoreUserDocIfExists,
};


