# MySQL データベーステスト（本番データなし）

このガイドでは、**本番データをコピーせずに**、ステージング環境のMySQLデータベースが正しく動作しているかをテストする方法を説明します。

## 📌 作業範囲

**重要**: ステージング環境構築は**ネットワーク的なクローン**が目的です。

- ✅ **テストする**: MySQLの接続確認、基本動作確認
- ❌ **テストしない**: 詳細なアプリケーション機能、データの正確性

つまり、「MySQLに接続できて、クエリが実行できればOK」です。

---

## 🎯 目的

本番データをコピーせずに、以下の**ネットワークレベルの確認**を行います：

1. ✅ Cloud SQLインスタンスが正常に起動している
2. ✅ データベース接続が正しく設定されている
3. ✅ Cloud RunからMySQLに接続できる（VPC経由）
4. ✅ テーブルが作成できる（基本動作確認）
5. ✅ クエリが正常に実行される（基本動作確認）

---

## 📋 前提条件

- Cloud SQLインスタンス作成済み (`nukune-stg-mysql`)
- データベース作成済み (`nukune_stg`)
- ユーザー作成済み (`nukune_app`)
- Firebase App Hostingデプロイ済み

---

## 方法1: 最小限のテストテーブルを作成

### ステップ1: Cloud SQLに接続

#### オプションA: GCP Consoleから（簡単）

1. GCP Console > Cloud SQL を開く
2. `nukune-stg-mysql` インスタンスをクリック
3. 上部の「Cloud Shell を開く」をクリック
4. 以下のコマンドを実行:

```bash
gcloud sql connect nukune-stg-mysql --user=root --quiet
```

5. rootパスワードを入力

#### オプションB: ローカルからCloud SQL Proxy経由

```bash
# Cloud SQL Proxyをダウンロード（初回のみ）
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# プロキシを起動（別ターミナル）
./cloud_sql_proxy -instances=nukune-stg:asia-northeast1:nukune-stg-mysql=tcp:3306

# MySQL クライアントで接続（別ターミナル）
mysql -h 127.0.0.1 -u nukune_app -p nukune_stg
```

### ステップ2: テスト用テーブルを作成

MySQLに接続したら、以下のSQLを実行:

```sql
-- nukune_stg データベースを使用
USE nukune_stg;

-- 最小限のテストテーブル作成
CREATE TABLE IF NOT EXISTS test_girls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT,
  area VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- テストデータ挿入
INSERT INTO test_girls (name, age, area) VALUES
  ('テストユーザー1', 25, '東京'),
  ('テストユーザー2', 28, '大阪'),
  ('テストユーザー3', 22, '福岡');

-- 確認
SELECT * FROM test_girls;
```

**期待される結果**:
```
+----+---------------------+------+--------+---------------------+
| id | name                | age  | area   | created_at          |
+----+---------------------+------+--------+---------------------+
|  1 | テストユーザー1     |   25 | 東京   | 2025-01-15 10:00:00 |
|  2 | テストユーザー2     |   28 | 大阪   | 2025-01-15 10:00:00 |
|  3 | テストユーザー3     |   22 | 福岡   | 2025-01-15 10:00:00 |
+----+---------------------+------+--------+---------------------+
```

### ステップ3: アプリケーションから接続テスト

テスト用APIエンドポイントを作成:

```typescript
// src/app/api/test-mysql-connection/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';

export async function GET() {
  try {
    // 接続テスト
    const result = await query('SELECT 1 as test');

    // テーブル存在確認
    const tables = await query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
    `);

    // テストデータ取得
    const testData = await query('SELECT * FROM test_girls LIMIT 5');

    return NextResponse.json({
      success: true,
      message: 'MySQL connection successful',
      database: process.env.DB_NAME,
      tables: tables.map((t: any) => t.TABLE_NAME),
      testData: testData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
```

デプロイ後、以下にアクセス:
```
https://your-staging-url/api/test-mysql-connection
```

**期待される結果**:
```json
{
  "success": true,
  "message": "MySQL connection successful",
  "database": "nukune_stg",
  "tables": ["test_girls"],
  "testData": [
    {
      "id": 1,
      "name": "テストユーザー1",
      "age": 25,
      "area": "東京",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## 方法2: 実際のテーブル構造でテスト（データなし）

### 本番のテーブル構造のみをコピー

#### ステップ1: 本番からスキーマのみエクスポート（データなし）

**本番環境へのアクセスがある場合**:

```bash
# スキーマのみダンプ（データは含まない）
mysqldump -h [本番DB_HOST] -u [本番DB_USER] -p \
  --no-data \
  --skip-add-drop-table \
  [本番DB_NAME] > schema_only.sql
```

#### ステップ2: ステージング環境にインポート

```bash
# Cloud SQL Proxyを使用
mysql -h 127.0.0.1 -u nukune_app -p nukune_stg < schema_only.sql
```

または、GCP Cloud Storageを経由:

```bash
# 1. Cloud Storageにアップロード
gsutil cp schema_only.sql gs://nukune-stg-bucket/

# 2. Cloud SQLにインポート
gcloud sql import sql nukune-stg-mysql \
  gs://nukune-stg-bucket/schema_only.sql \
  --database=nukune_stg
```

これで、テーブル構造は本番と同じだが、データは空の状態になります。

---

## 方法3: コードから推測してテーブルを手動作成

本番環境へのアクセスがない場合、コードから必要なテーブル構造を推測できます。

### 主要テーブルの推測

コード (`src/lib/mysql/girls-optimized.ts`) から、以下のテーブルが必要と推測:

#### 1. `girl_profiles` テーブル（女性プロフィール）

```sql
CREATE TABLE IF NOT EXISTS girl_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT,
  area VARCHAR(100),
  shop_id INT,
  shop_name VARCHAR(200),
  girl_type_id INT,
  body_type VARCHAR(50),
  height INT,
  weight INT,
  cup_size VARCHAR(10),
  profile_text TEXT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  display_priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shop_id (shop_id),
  INDEX idx_area (area),
  INDEX idx_age (age),
  INDEX idx_is_active (is_active),
  INDEX idx_display_priority (display_priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 2. `shops` テーブル（店舗情報）

```sql
CREATE TABLE IF NOT EXISTS shops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  area VARCHAR(100),
  address VARCHAR(500),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_area (area)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3. `girl_schedules` テーブル（出勤スケジュール）

```sql
CREATE TABLE IF NOT EXISTS girl_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  girl_id INT NOT NULL,
  schedule_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (girl_id) REFERENCES girl_profiles(id) ON DELETE CASCADE,
  INDEX idx_girl_date (girl_id, schedule_date),
  INDEX idx_schedule_date (schedule_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### テストデータの挿入

```sql
-- ダミー店舗
INSERT INTO shops (name, area, latitude, longitude) VALUES
  ('テスト店舗 東京', '東京', 35.6812, 139.7671),
  ('テスト店舗 大阪', '大阪', 34.6937, 135.5023);

-- ダミー女性プロフィール
INSERT INTO girl_profiles (name, age, area, shop_id, shop_name, height, weight) VALUES
  ('さくら', 25, '東京', 1, 'テスト店舗 東京', 160, 48),
  ('みゆき', 28, '大阪', 2, 'テスト店舗 大阪', 165, 52),
  ('あやか', 22, '東京', 1, 'テスト店舗 東京', 158, 45);

-- ダミー出勤スケジュール（今日から7日間）
INSERT INTO girl_schedules (girl_id, schedule_date, start_time, end_time) VALUES
  (1, CURDATE(), '10:00:00', '18:00:00'),
  (1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00', '18:00:00'),
  (2, CURDATE(), '12:00:00', '20:00:00'),
  (3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '14:00:00', '22:00:00');
```

---

## 方法4: アプリケーションの既存APIでテスト

### `/api/db-info` を使用（情報確認用）

デプロイ済みのアプリに、データベース情報を取得するAPIがあります:

```
GET https://your-staging-url/api/db-info
```

**期待されるレスポンス**:
```json
{
  "database": "nukune_stg",
  "tables": ["girl_profiles", "shops", "girl_schedules"],
  "connection": "success"
}
```

### `/api/mysql-girls-fast` でクエリテスト

```
GET https://your-staging-url/api/mysql-girls-fast?limit=5
```

**データが空の場合の期待レスポンス**:
```json
{
  "girls": [],
  "total": 0,
  "hasMore": false
}
```

**エラーが出る場合**: テーブルが存在しないか、接続エラー

---

## ✅ 確認チェックリスト

### レベル1: 基本接続テスト
- [ ] Cloud SQLインスタンスが起動している
- [ ] MySQLクライアントから接続できる
- [ ] `SELECT 1` クエリが成功する

### レベル2: テーブル作成テスト
- [ ] テストテーブルが作成できる
- [ ] データ挿入ができる
- [ ] データ取得ができる

### レベル3: アプリケーション接続テスト
- [ ] `/api/test-mysql-connection` が成功
- [ ] 環境変数が正しく設定されている
- [ ] Cloud RunからCloud SQLに接続できる

### レベル4: 実テーブルテスト（オプション）
- [ ] 本番と同じテーブル構造を作成
- [ ] ダミーデータで動作確認
- [ ] `/api/mysql-girls-fast` などのAPIが動作

---

## 🐛 トラブルシューティング

### エラー: `Error: connect ETIMEDOUT`

**原因**: Cloud RunからCloud SQLに接続できない

**解決方法**:
1. Cloud Run サービスに Cloud SQL 接続が追加されているか確認
   - GCP Console > Cloud Run > サービス > 接続タブ
2. VPC Connector が正しく設定されているか確認
3. `apphosting.yaml` の設定を確認

### エラー: `Access denied for user 'nukune_app'`

**原因**: ユーザー権限の問題

**解決方法**:
```sql
-- rootユーザーで実行
GRANT ALL PRIVILEGES ON nukune_stg.* TO 'nukune_app'@'%';
FLUSH PRIVILEGES;
```

### エラー: `Unknown database 'nukune_stg'`

**原因**: データベースが作成されていない

**解決方法**:
```sql
CREATE DATABASE nukune_stg
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### エラー: `Table 'nukune_stg.girl_profiles' doesn't exist`

**原因**: テーブルが作成されていない

**解決方法**: 上記の「方法3」のCREATE TABLE文を実行

---

## 🎓 本番データをコピーする場合との比較

| 項目 | テストデータのみ | 本番データコピー |
|------|------------------|------------------|
| **データ量** | 少量（3-10件） | 大量（本番と同じ） |
| **セットアップ時間** | 5-10分 | 30分-数時間 |
| **個人情報** | なし（安全） | マスキング必要 |
| **テスト精度** | 基本動作のみ | 本番に近い |
| **ストレージコスト** | 最小 | 高い |
| **推奨用途** | 接続確認、基本機能テスト | 負荷テスト、データ移行テスト |

---

## 📝 まとめ

### 推奨アプローチ

ステージング環境の目的に応じて選択:

1. **接続確認のみ**: 方法1（最小テーブル）
2. **基本機能テスト**: 方法3（実テーブル構造 + ダミーデータ）
3. **本格的なテスト**: 方法2（スキーマコピー + ダミーまたは本番データ）

### 最小限の手順（5分で完了）

```sql
-- 1. Cloud SQLに接続
USE nukune_stg;

-- 2. テストテーブル作成
CREATE TABLE test_girls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  age INT
);

-- 3. テストデータ挿入
INSERT INTO test_girls (name, age) VALUES ('Test', 25);

-- 4. 確認
SELECT * FROM test_girls;
```

これで、MySQLが正常に動作していることを確認できます！

---

## 次のステップ

1. ✅ この手順で接続確認完了
2. ➡️ 必要に応じて本番スキーマをコピー
3. ➡️ ダミーデータで各APIの動作確認
4. ➡️ 本格的なテストデータ作成（オプション）

何か問題が発生した場合は、エラーメッセージとどの手順で発生したかを記録してください。
