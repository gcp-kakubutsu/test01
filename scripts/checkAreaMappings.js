#!/usr/bin/env node

/**
 * @file 地域コード検証スクリプト
 * @description
 * - MySQL に接続し、都道府県テーブル `area_prefectures` の `id` と `area_large_id`（地方ID）の対応を検証します。
 * - （存在すれば）`area_larges` テーブルから地方ID→地方名の対応も取得して検証します。
 * - 具体的なサンプルとして、指定された女の子ID（例: 297）の所属都道府県/地方IDを確認します。
 *
 * 仕様と制限:
 * - 環境変数 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` を `.env` から読み込みます。
 * - 読み取り専用の安全なクエリのみ実行します。
 * - 取得件数が多い場合は適宜 LIMIT を設定して出力量を抑えます。
 */

const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * @typedef {Object} PrefectureRow
 * @property {number} id 都道府県ID
 * @property {number} area_large_id 地方ID
 * @property {string} name 都道府県名
 * @property {string} [alphabet] アルファベット表記
 */

/**
 * @typedef {Object} LargeAreaRow
 * @property {number} id 地方ID
 * @property {string} name 地方名
 */

/**
 * @typedef {Object} GirlCheckRow
 * @property {number} girl_id 女の子ID
 * @property {number|null} area_prefecture_id 店舗の都道府県ID
 * @property {string|null} prefecture_name 都道府県名
 * @property {number|null} area_large_id 地方ID
 */

/**
 * メイン処理
 * @param {number} targetGirlId 検証対象の女の子ID
 */
async function main(targetGirlId = 297) {
  /** @type {import('mysql2/promise').Connection} */
  let conn;
  try {
    console.log('🔌 Connecting to MySQL...');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      ssl: { rejectUnauthorized: false },
      connectTimeout: 20000,
    });
    console.log('✅ Connected.\n');

    // 1) 都道府県 → 地方ID の一覧
    console.log('📋 area_prefectures: id, area_large_id, name');
    const [prefRows] = await conn.execute(
      'SELECT id, area_large_id, name, alphabet FROM area_prefectures ORDER BY id ASC'
    );
    /** @type {PrefectureRow[]} */
    const prefectures = prefRows;
    console.table(prefectures);

    // 2) 地方IDごとの件数
    console.log('\n📊 area_large_id 分布 (area_prefectures)');
    const [distRows] = await conn.execute(
      'SELECT area_large_id, COUNT(*) AS cnt FROM area_prefectures GROUP BY area_large_id ORDER BY area_large_id'
    );
    console.table(distRows);

    // 3) 地方マスタ（存在すれば）
    console.log('\n🗺️  area_larges テーブルの確認（存在すれば名称を表示）');
    try {
      const [largeRows] = await conn.execute(
        'SELECT id, name FROM area_larges ORDER BY id ASC'
      );
      /** @type {LargeAreaRow[]} */
      const largeAreas = largeRows;
      if (largeAreas.length > 0) {
        console.table(largeAreas);
      } else {
        console.log('(空の結果)');
      }
    } catch (e) {
      console.log('（area_larges テーブルは存在しない可能性があります）');
    }

    // 4) サンプル: 指定ID(例: 297)の女の子の都道府県/地方IDを確認
    console.log(`\n🔎 女の子ID=${targetGirlId} の所属都道府県/地方ID`);
    const [girlRows] = await conn.execute(
      `SELECT 
         g.id AS girl_id,
         s.area_prefecture_id,
         p.name AS prefecture_name,
         p.area_large_id
       FROM girl_profiles g
       INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
       LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
       WHERE g.id = ?
       LIMIT 1`,
      [targetGirlId]
    );
    /** @type {GirlCheckRow[]} */
    const girlCheck = girlRows;
    if (girlCheck.length === 0) {
      console.log('対象の女の子が見つかりませんでした。');
    } else {
      console.table(girlCheck);
    }

    // 5) データ整合性の簡易チェック
    console.log('\n✅ 簡易チェック');
    const invalid = prefectures.filter(p => p.area_large_id == null);
    if (invalid.length > 0) {
      console.log(`- area_large_id が NULL の都道府県: ${invalid.length}件`);
      console.table(invalid);
    } else {
      console.log('- すべての都道府県に area_large_id が設定されています');
    }

    console.log('\n🧭 確認完了');
  } catch (err) {
    console.error('❌ 検証中にエラーが発生しました:', err?.message || err);
    process.exitCode = 1;
  } finally {
    if (conn) {
      try { await conn.end(); } catch {}
    }
  }
}

// 実行
const targetGirlId = process.argv[2] ? parseInt(process.argv[2], 10) : 297;
main(targetGirlId);
