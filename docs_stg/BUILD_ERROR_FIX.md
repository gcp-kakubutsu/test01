# ビルドエラー修正ガイド

このドキュメントは、Firebase App Hostingでのビルドエラーを解決するための詳細な手順を説明します。

## 🔴 発生しているエラー

### エラー1: Firebase Admin SDK未初期化
```
Firebase Admin SDK initialization failed: No credentials found.
For production, set FIREBASE_ADMIN_* environment variables.
```

### エラー2: TRANSACTION_HUB_API_KEY未設定
```
Error: TRANSACTION_HUB_API_KEY is not configured
Export encountered an error on /subscription/success/page
```

### エラー3: MySQL接続エラー（ビルド時）
```
Error: connect ECONNREFUSED 127.0.0.1:3306
Location cache refresh failed
```

---

## 🎯 解決策の全体像

ビルドを成功させるには、以下の環境変数を**すべて**設定する必要があります：

1. ✅ Firebase Admin SDK認証情報（3つ）
2. ✅ Transaction Hub APIキー（2つ）
3. ✅ MySQL接続情報（5つ）
4. ✅ その他必須環境変数

### 🔐 推奨される設定方法（2つの選択肢）

#### 方法1: Secret Manager + apphosting.staging.yaml（推奨）✨

**メリット**:
- ✅ シークレットをGitHubにプッシュしない（最も安全）
- ✅ Google Cloud Secret Managerで暗号化保存
- ✅ バージョン管理が可能
- ✅ `apphosting.staging.yaml`はGitHubに安全にプッシュできる（参照のみ）

**詳細な手順**: `SECRET_MANAGER_SETUP.md` を参照してください（コンソールのみで完結）

#### 方法2: Firebase Console環境変数設定（シンプル）

**メリット**:
- ✅ Firebase Consoleから直接設定（簡単）
- ✅ UIで視覚的に管理

**注意**: Firebase Consoleで環境変数UIが表示されない場合は、方法1を使用してください。

---

このドキュメントでは**方法2**の手順を詳しく説明します。
**方法1**を使用する場合は、`SECRET_MANAGER_SETUP.md`を参照してください。

---

## 📋 詳細な修正手順

### ステップ1: Firebase Admin SDK認証情報の取得

#### 1.1 サービスアカウントキーの生成

1. **Firebase Consoleにアクセス**
   ```
   https://console.firebase.google.com
   ```

2. **プロジェクトを選択**
   - `nukune-stg01-475508` を選択

3. **サービスアカウントページを開く**
   - 左上の歯車アイコン ⚙️ をクリック
   - 「プロジェクトの設定」を選択
   - 上部タブの「サービス アカウント」をクリック

4. **新しい秘密鍵を生成**
   - 下部の「新しい秘密鍵の生成」ボタンをクリック
   - 警告ダイアログで「キーを生成」をクリック
   - JSONファイルがダウンロードされます

#### 1.2 JSONファイルの内容確認

ダウンロードしたJSONファイルを開くと、以下のような内容が含まれています：

```json
{
  "type": "service_account",
  "project_id": "nukune-stg01-475508",
  "private_key_id": "xxxxxxxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0B...(長い文字列)...=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@nukune-stg01-475508.iam.gserviceaccount.com",
  "client_id": "xxxxxxxxxxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

#### 1.3 必要な値を抽出

このJSONから以下の3つの値を抽出します：

1. **`project_id`** → `FIREBASE_ADMIN_PROJECT_ID`
2. **`client_email`** → `FIREBASE_ADMIN_CLIENT_EMAIL`
3. **`private_key`** → `FIREBASE_ADMIN_PRIVATE_KEY`

**重要**: `private_key`はそのままコピーしてください（改行の`\n`を含めて）。

---

### ステップ2: Firebase App Hostingに環境変数を設定

#### 2.1 環境変数設定画面を開く

1. **Firebase Consoleにアクセス**
   ```
   https://console.firebase.google.com
   ```

2. **App Hostingを開く**
   - 左メニューから「ビルド」→「App Hosting」を選択

3. **バックエンドを選択**
   - `nukune-staging` バックエンドをクリック

4. **環境変数設定を開く**
   - 「設定」タブまたは「Environment variables」セクションを開く
   - 「環境変数を追加」または「Edit」をクリック

#### 2.2 必須環境変数を追加

以下の環境変数を**すべて**追加してください：

---

### 🔑 グループ1: Firebase Client SDK（公開情報）

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlz4JUgJS26U_vn5nj764FAmfs0QkonVM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nukune-stg01-475508.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nukune-stg01-475508
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nukune-stg01-475508.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=687518426651
NEXT_PUBLIC_FIREBASE_APP_ID=1:687518426651:web:42713210ded2edcc927abe
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-83ETQR1EWM
```

---

### 🔐 グループ2: Firebase Admin SDK（秘密情報）⚠️ 最重要

**これらが欠けるとビルドエラーになります！**

```bash
FIREBASE_ADMIN_PROJECT_ID=nukune-stg01-475508
```

```bash
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@nukune-stg01-475508.iam.gserviceaccount.com
```
↑ JSONファイルの`client_email`をコピー

```bash
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...(非常に長い)...=\n-----END PRIVATE KEY-----\n"
```
↑ JSONファイルの`private_key`をコピー（そのまま、`\n`を含めて）

**重要**:
- `FIREBASE_ADMIN_PRIVATE_KEY`は必ず**ダブルクォート**で囲んでください
- 改行が`\n`になっていることを確認してください
- 値全体をコピーしてください（`-----BEGIN`から`-----END`まで）

---

### 🗄️ グループ3: MySQL / Cloud SQL接続

```bash
DB_HOST=/cloudsql/nukune-stg:asia-northeast1:nukune-stg-mysql
```
↑ Cloud SQL接続文字列（Unix socketパス）

```bash
DB_USER=nukune_app
```

```bash
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
```
↑ Cloud SQLインスタンス作成時に設定したパスワード

```bash
DB_NAME=nukune_stg
```

```bash
DB_PORT=3306
```

---

### 💳 グループ4: Transaction Hub API（決済関連）⚠️ ビルドエラーの原因

**これらが欠けると`/subscription/success`ページでビルドエラーになります！**

ステージング環境では実際のAPIキーがなくてもOKです。プレースホルダーを使用：

```bash
TRANSACTION_HUB_API_KEY=stg_test_placeholder_key
```

```bash
NEXT_PUBLIC_TRANSACTION_HUB_API_KEY=stg_test_placeholder_key
```

**注意**: 本番環境では実際のAPIキーが必要です。

---

### 🤖 グループ5: Google Genkit（AI機能）

```bash
GOOGLE_GENKIT_API_KEY=YOUR_GENKIT_API_KEY_HERE
```

取得方法: [Google AI Studio](https://aistudio.google.com/app/apikey)

ステージングで使わない場合は、ダミー値でもOK：
```bash
GOOGLE_GENKIT_API_KEY=dummy_key_for_staging
```

---

### 🔒 グループ6: セキュリティ設定

```bash
API_REGISTER_PASSWORD=your_secure_admin_password_here
```
↑ 管理者ページ用パスワード（任意の強力なパスワード）

```bash
JWT_SECRET=your_jwt_secret_at_least_32_characters_long_random_string
```
↑ JWT署名用シークレット（32文字以上のランダム文字列）

生成方法:
```bash
openssl rand -base64 48
```

```bash
ADMIN_EMAILS=admin@example.com
```
↑ 管理者のメールアドレス

```bash
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
```
↑ 同じメールアドレス（クライアント側用）

---

### 🌐 グループ7: 外部サービス

```bash
NEXT_PUBLIC_RESERVATION_SITE_URL=https://stg.nukipedia.jp
```

---

### ⚙️ グループ8: その他

```bash
NODE_ENV=production
```
↑ **必ず `production` に設定**（`staging`ではない）

---

### ステップ3: 環境変数設定の確認

#### 3.1 設定完了後の確認

環境変数を追加したら、以下を確認：

- [ ] **グループ1**: Firebase Client SDK（7個）
- [ ] **グループ2**: Firebase Admin SDK（3個）⚠️
- [ ] **グループ3**: MySQL（5個）
- [ ] **グループ4**: Transaction Hub（2個）⚠️
- [ ] **グループ5**: Genkit（1個）
- [ ] **グループ6**: セキュリティ（4個）
- [ ] **グループ7**: 外部サービス（1個）
- [ ] **グループ8**: その他（1個）

**合計: 24個の環境変数**

#### 3.2 特に重要な変数（ビルドエラーの原因）

以下が**絶対に必須**です：

1. ✅ `FIREBASE_ADMIN_PROJECT_ID`
2. ✅ `FIREBASE_ADMIN_CLIENT_EMAIL`
3. ✅ `FIREBASE_ADMIN_PRIVATE_KEY`
4. ✅ `TRANSACTION_HUB_API_KEY`
5. ✅ `NEXT_PUBLIC_TRANSACTION_HUB_API_KEY`

これら5つが欠けると100%ビルドエラーになります。

---

### ステップ4: 再デプロイ

#### 4.1 環境変数保存後

Firebase App Hostingの環境変数画面で：

1. 「保存」または「Save」ボタンをクリック
2. 自動的に再ビルドが開始される場合があります

#### 4.2 手動で再デプロイ

自動で開始されない場合、手動でトリガー：

```bash
# ローカルで空コミット作成
git commit --allow-empty -m "chore: trigger rebuild with all env vars"

# stagingブランチにプッシュ
git push origin staging
```

#### 4.3 ビルドログの確認

1. Firebase Console > App Hosting > ビルド履歴
2. 最新のビルドをクリック
3. ログを確認

**成功の兆候**:
```
✓ Generating static pages
✓ Finalizing page optimization
Build completed successfully
```

**まだエラーが出る場合**:
- どの環境変数が欠けているかログで確認
- このドキュメントの該当セクションを再確認

---

## 🐛 トラブルシューティング

### エラー: "FIREBASE_ADMIN_PRIVATE_KEY is not configured"

**原因**:
- 環境変数が設定されていない
- または、値が正しくない（クォートが欠けている）

**解決方法**:
1. JSONファイルから`private_key`を再度コピー
2. 値全体を`"`で囲む
3. `\n`がそのまま含まれていることを確認

**正しい例**:
```bash
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**間違った例**:
```bash
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...  # クォートなし ❌
```

---

### エラー: "TRANSACTION_HUB_API_KEY is not configured"

**原因**: 環境変数が未設定

**解決方法**:
ステージング環境では以下でOK:
```bash
TRANSACTION_HUB_API_KEY=stg_placeholder
NEXT_PUBLIC_TRANSACTION_HUB_API_KEY=stg_placeholder
```

両方とも設定してください（`NEXT_PUBLIC_`プレフィックス付きも必要）。

---

### エラー: "connect ECONNREFUSED 127.0.0.1:3306"

**原因**: ビルド時にMySQLに接続しようとしている（正常）

**これは警告です。ビルドは続行されます。**

ランタイムで解決するため、以下を確認：
- Cloud Run サービスに Cloud SQL 接続が追加されているか
- `DB_HOST`が正しいパス（`/cloudsql/...`）になっているか

---

### エラー: ビルドが途中で止まる

**原因**: メモリ不足 or タイムアウト

**解決方法**:
`apphosting.staging.yaml`で`memoryMiB`を増やす:
```yaml
runConfig:
  memoryMiB: 8192  # 8GBに増量
```

---

### Firebase Consoleで環境変数UIが表示されない

**原因**: すべてのユーザーに環境変数UIが提供されているわけではない

**解決方法**:
Secret Manager + `apphosting.staging.yaml`を使用してください。

詳細は `SECRET_MANAGER_SETUP.md` を参照。

---

## ✅ 最終確認チェックリスト

ビルド成功のために、以下をすべて確認：

### 環境変数
- [ ] Firebase Client SDK（7個）すべて設定済み
- [ ] Firebase Admin SDK（3個）すべて設定済み
- [ ] `FIREBASE_ADMIN_PRIVATE_KEY`が`"`で囲まれている
- [ ] MySQL接続情報（5個）すべて設定済み
- [ ] Transaction Hub（2個）すべて設定済み
- [ ] その他必須変数すべて設定済み

### ビルド確認
- [ ] 環境変数を保存した
- [ ] 再デプロイをトリガーした
- [ ] ビルドログでエラーがないことを確認
- [ ] デプロイ完了を確認

---

## 📝 環境変数設定の完全なテンプレート

コピー＆ペースト用（値は置き換えてください）:

```bash
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlz4JUgJS26U_vn5nj764FAmfs0QkonVM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nukune-stg01-475508.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nukune-stg01-475508
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nukune-stg01-475508.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=687518426651
NEXT_PUBLIC_FIREBASE_APP_ID=1:687518426651:web:42713210ded2edcc927abe
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-83ETQR1EWM

# Firebase Admin SDK (JSONファイルから取得)
FIREBASE_ADMIN_PROJECT_ID=nukune-stg01-475508
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@nukune-stg01-475508.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# MySQL
DB_HOST=/cloudsql/nukune-stg:asia-northeast1:nukune-stg-mysql
DB_USER=nukune_app
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=nukune_stg
DB_PORT=3306

# Transaction Hub
TRANSACTION_HUB_API_KEY=stg_placeholder_key
NEXT_PUBLIC_TRANSACTION_HUB_API_KEY=stg_placeholder_key

# Genkit
GOOGLE_GENKIT_API_KEY=YOUR_GENKIT_KEY_OR_DUMMY

# Security
API_REGISTER_PASSWORD=your_secure_password
JWT_SECRET=your_random_jwt_secret_32plus_chars
ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# External
NEXT_PUBLIC_RESERVATION_SITE_URL=https://stg.nukipedia.jp

# Other
NODE_ENV=production
```

---

## 🎯 次のステップ

ビルドが成功したら：

1. ✅ デプロイされたURLにアクセス
2. ✅ 基本的な動作確認（ページが表示されるか）
3. ✅ ネットワーク構成の確認（固定IP等）

詳細は `STAGING_SETUP.md` の「最終確認チェックリスト」を参照してください。

---

## 📚 関連ドキュメント

- **`SECRET_MANAGER_SETUP.md`**: Secret Manager + apphosting.staging.yamlの詳細手順（推奨）
- **`STAGING_SETUP.md`**: ステージング環境全体の構築手順
- **`STAGING_PREREQUISITES.md`**: 事前準備チェックリスト

---

## 📞 まだ解決しない場合

1. ビルドログ全体をコピー
2. エラーメッセージを特定
3. このドキュメントの該当セクションを再確認
4. Firebase Consoleで環境変数UIが表示されない場合は `SECRET_MANAGER_SETUP.md` を参照
5. チームに相談（ログとエラーメッセージを共有）

---

**Good luck! 🚀**
