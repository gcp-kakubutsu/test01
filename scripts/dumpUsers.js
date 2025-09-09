#!/usr/bin/env node

/**
 * @file usersコレクションの全データを取得し、標準出力に表示/任意でファイル出力するスクリプト
 * @description
 * - Firebase Admin SDK を利用して Firestore の `users` コレクションから全ドキュメントを取得します。
 * - Firestore 特有の型（Timestamp, GeoPoint, DocumentReference 等）をできる限りJSONフレンドリに直列化して出力します。
 * - オプションで整形表示（--pretty）や、ファイル保存（--output=PATH）に対応します。
 *
 * 仕様:
 * - コマンドライン引数:
 *   - --pretty: 出力JSONをインデント付きで整形
 *   - --output=PATH: 指定パスにJSONファイルを書き出し（標準出力にもサマリは出力）
 *   - --limit=N: N件のみ取得・表示（デバッグ/確認用）
 * - 出力内容:
 *   - 配列形式で、各要素は { id: string, data: Record<string, any> } を表す
 * - エラーハンドリング:
 *   - 可能な限り詳細な情報（関数名、引数など）を含めて標準エラー出力へ記録
 *
 * 制限事項:
 * - users の件数が非常に多い場合、単回の get() は非効率になる可能性があります（本スクリプトは簡便性を優先）。
 * - 未知のカスタム型は適切に直列化できないことがあります（可能な限り安全に文字列へフォールバック）。
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * @typedef {Object} CliOptions
 * @property {boolean} pretty - 整形表示の有無
 * @property {string|null} outputPath - 出力ファイルパス
 * @property {number|null} limit - 取得件数の上限
 */

/**
 * コマンドライン引数を解析する
 * @returns {CliOptions} 解析結果
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const pretty = args.includes('--pretty');
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : null;
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  return { pretty, outputPath, limit };
}

/**
 * Firebase Admin を初期化する
 * @returns {admin.app.App} 初期化済みアプリケーションインスタンス
 */
function initializeFirebaseAdmin() {
  try {
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase configuration. Please set FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.');
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

      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      console.log('✅ Firebase Admin initialized successfully');
      return app;
    }
    return admin.apps[0];
  } catch (error) {
    console.error('❌ initializeFirebaseAdmin Error:', error.message);
    throw error;
  }
}

/**
 * Firestoreの値をJSONフレンドリな形へ再帰的に直列化する
 * @param {any} value - 任意の値
 * @param {string} pathTrace - デバッグ用のキー経路（例: root.profile.createdAt）
 * @returns {any} 直列化後の値
 */
function serializeFirestoreValue(value, pathTrace) {
  try {
    if (value === null || value === undefined) {
      return value;
    }
    // Timestamp（admin SDK）: toDate が存在すればISO文字列へ
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    // GeoPoint
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
      return { latitude: value.latitude, longitude: value.longitude };
    }
    // DocumentReference
    if (typeof value.path === 'string' && typeof value.id === 'string') {
      return { refPath: value.path, id: value.id };
    }
    // 配列
    if (Array.isArray(value)) {
      return value.map((v, idx) => serializeFirestoreValue(v, `${pathTrace}[${idx}]`));
    }
    // プレーンオブジェクト
    if (typeof value === 'object') {
      const serialized = {};
      for (const [k, v] of Object.entries(value)) {
        serialized[k] = serializeFirestoreValue(v, `${pathTrace}.${k}`);
      }
      return serialized;
    }
    // プリミティブ
    return value;
  } catch (error) {
    console.error(`❌ serializeFirestoreValue Error at ${pathTrace}:`, error.message);
    return String(value);
  }
}

/**
 * users コレクションの全件を取得して直列化する
 * @param {number|null} limit - 取得上限（null の場合は全件）
 * @returns {Promise<Array<{id: string, data: Record<string, any>}>>} 取得結果
 */
async function fetchAllUsers(limit) {
  try {
    const db = admin.firestore();
    let query = db.collection('users');
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    const results = [];
    snapshot.forEach((doc) => {
      const raw = doc.data();
      const serialized = serializeFirestoreValue(raw, `root(${doc.id})`);
      results.push({ id: doc.id, data: serialized });
    });
    return results;
  } catch (error) {
    console.error('❌ fetchAllUsers Error:', error.message);
    throw error;
  }
}

/**
 * 結果を標準出力へ表示、必要に応じてファイルにも保存
 * @param {Array<object>} users - ユーザー配列
 * @param {CliOptions} options - CLIオプション
 * @returns {void}
 */
function outputUsers(users, options) {
  try {
    const indent = options.pretty ? 2 : 0;
    const json = JSON.stringify(users, null, indent);
    if (options.outputPath) {
      const absPath = path.isAbsolute(options.outputPath)
        ? options.outputPath
        : path.join(process.cwd(), options.outputPath);
      fs.writeFileSync(absPath, json, 'utf8');
      console.log(`\n📁 Wrote ${users.length} users to: ${absPath}`);
    }
    // 標準出力へ全件表示（pretty 指定時は整形）
    console.log('\n================ USERS DUMP ================');
    console.log(json);
    console.log('===========================================');
    console.log(`\n📊 Summary: ${users.length} user(s)`);
  } catch (error) {
    console.error('❌ outputUsers Error:', error.message);
    throw error;
  }
}

/**
 * メイン実行関数
 * @returns {Promise<void>} 実行結果
 */
async function main() {
  let app;
  try {
    const options = parseArgs();
    console.log('🚀 Dump Users Script');
    console.log('====================');
    console.log(`Options: pretty=${options.pretty}, output=${options.outputPath || 'none'}, limit=${options.limit || 'none'}`);

    app = initializeFirebaseAdmin();
    const users = await fetchAllUsers(options.limit);
    outputUsers(users, options);
  } catch (error) {
    console.error('❌ main Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (app) {
      try {
        await admin.app().delete();
      } catch (e) {
        // クリーンアップエラーは無視
      }
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  initializeFirebaseAdmin,
  serializeFirestoreValue,
  fetchAllUsers,
  outputUsers
};


