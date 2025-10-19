# Google Cloud Secret Manager セットアップガイド（コンソール版）

このドキュメントでは、**Google Cloud Consoleのみ**を使用して、Firebase App Hostingで環境変数を安全に管理する方法を説明します。

## 🎯 なぜSecret Managerを使うのか？

Firebase Consoleで環境変数UIが表示されない場合、または、より安全な管理を行いたい場合は、以下の方法を使用します：

- ✅ **安全**: シークレットをGitHubにプッシュしない
- ✅ **暗号化**: Google Cloud がシークレットを暗号化して保存
- ✅ **バージョン管理**: シークレットの履歴管理が可能
- ✅ **アクセス制御**: IAMで細かい権限設定が可能
- ✅ **コンソールのみ**: CLIコマンド不要

## 📋 前提条件

- GCPプロジェクト `nukune-stg` が存在
- GCP Consoleへのアクセス権限（オーナーまたは編集者）
- Firebaseサービスアカウントキー（JSON）をダウンロード済み
- リポジトリの`staging`ブランチへのアクセス権限

---

## 🚀 セットアップ手順

### ステップ1: Secret Manager APIを有効化

1. **GCP Consoleを開く**
   ```
   https://console.cloud.google.com
   ```

2. **プロジェクトを選択**
   - 画面上部のプロジェクト選択で `nukune-stg` を選択

3. **APIとサービスを開く**
   - 左メニュー ☰ → 「APIとサービス」 → 「ライブラリ」

4. **Secret Manager APIを検索**
   - 検索バーに「Secret Manager API」と入力
   - 「Secret Manager API」をクリック

5. **APIを有効化**
   - 「有効にする」ボタンをクリック
   - 有効化完了まで数秒待つ

---

### ステップ2: シークレットを作成

#### 2.1 Secret Managerページを開く

1. **GCP Console左メニュー** ☰ → 「セキュリティ」 → 「Secret Manager」
2. または直接アクセス:
   ```
   https://console.cloud.google.com/security/secret-manager?project=nukune-stg
   ```

#### 2.2 Firebase Admin Private Key（最重要）

1. **「シークレットを作成」ボタンをクリック**

2. **シークレットの詳細を入力**:
   - **名前**: `firebase-admin-private-key`
   - **シークレットの値**:
     1. ダウンロードしたFirebase JSONファイル（`nukune-stg01-475508-xxxxx.json`）をテキストエディタで開く
     2. `"private_key"` の値をコピー（`"-----BEGIN PRIVATE KEY-----\n...` から `...\n-----END PRIVATE KEY-----\n"` まで）
     3. ダブルクォート（`"`）を削除
     4. `\n` はそのまま残す
   - **リージョン**: 「自動」（デフォルト）

3. **「シークレットを作成」ボタンをクリック**

**例**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
...（長い文字列）...
...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-----END PRIVATE KEY-----
```

#### 2.3 Firebase Admin Client Email

1. **「シークレットを作成」**をクリック

2. **シークレットの詳細**:
   - **名前**: `firebase-admin-client-email`
   - **シークレットの値**: Firebase JSONファイルから`client_email`の値をコピー
     ```
     firebase-adminsdk-xxxxx@nukune-stg01-475508.iam.gserviceaccount.com
     ```

3. **「シークレットを作成」**

#### 2.4 MySQL Database パスワード

1. **「シークレットを作成」**をクリック

2. **シークレットの詳細**:
   - **名前**: `db-password`
   - **シークレットの値**: 強力なパスワードを生成
     - 推奨: 32文字以上のランダム文字列
     - 生成ツール: https://passwordsgenerator.net/ （64文字、すべてのオプション有効）
     - 例: `Kx9mP2vN8qR5tY7wE3bF6jH0lA4sD1gZ`

3. **「シークレットを作成」**

**重要**: このパスワードを別途メモ帳に保存（Cloud SQLでユーザー作成時に使用します）

#### 2.5 Transaction Hub API Key

1. **「シークレットを作成」**をクリック

2. **シークレットの詳細**:
   - **名前**: `transaction-hub-api-key`
   - **シークレットの値**: ステージング環境用プレースホルダー
     ```
     stg_test_placeholder_key
     ```

3. **「シークレットを作成」**

#### 2.6 Google Genkit API Key

1. **Google AI Studioでキーを取得**
   ```
   https://aistudio.google.com/app/apikey
   ```
   - 「Create API Key」をクリック
   - プロジェクトを選択
   - キーをコピー（例: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`）

2. **GCP Console > Secret Manager**で「シークレットを作成」

3. **シークレットの詳細**:
   - **名前**: `google-genkit-api-key`
   - **シークレットの値**: 上記でコピーしたAPIキー

4. **「シークレットを作成」**

#### 2.7 API Register Password（管理者ページ用）

1. **「シークレットを作成」**をクリック

2. **シークレットの詳細**:
   - **名前**: `api-register-password`
   - **シークレットの値**: 管理者ページ用の強力なパスワード
     - 推奨: 24文字以上
     - 例: `AdminPass2025!Secure@Nukune`

3. **「シークレットを作成」**

#### 2.8 JWT Secret

1. **「シークレットを作成」**をクリック

2. **シークレットの詳細**:
   - **名前**: `jwt-secret`
   - **シークレットの値**: ランダムな長い文字列（64文字以上）
     - 推奨: https://randomkeygen.com/ の「Fort Knox Passwords」を使用
     - 例: `9k3H7mP2vN8qR5tY7wE3bF6jH0lA4sD1gZ5xC9uV2nB8mQ4wE7rT3yU1iO6pA0sD5fG2hJ9kL3zX`

3. **「シークレットを作成」**

---

### ステップ3: 作成したシークレットを確認

Secret Managerページ（https://console.cloud.google.com/security/secret-manager?project=nukune-stg）で、以下のシークレットが存在することを確認：

**必須シークレット（7個）**:
- ✅ `firebase-admin-private-key`
- ✅ `firebase-admin-client-email`
- ✅ `db-password`
- ✅ `transaction-hub-api-key`
- ✅ `google-genkit-api-key`
- ✅ `api-register-password`
- ✅ `jwt-secret`

---

### ステップ4: サービスアカウントに権限を付与

#### 4.1 プロジェクト番号を確認

1. **GCP Console > ダッシュボード**
   ```
   https://console.cloud.google.com/home/dashboard?project=nukune-stg
   ```

2. **プロジェクト情報カード**で「プロジェクト番号」を確認してメモ
   - 例: `123456789012`

3. **サービスアカウントのメールアドレス**:
   ```
   [プロジェクト番号]-compute@developer.gserviceaccount.com
   ```
   - 例: `123456789012-compute@developer.gserviceaccount.com`

#### 4.2 各シークレットに権限を付与

**以下の手順を7つのシークレットすべてに対して繰り返します**:

1. **Secret Managerページ**で、シークレット名（例: `firebase-admin-private-key`）をクリック

2. **「権限」タブ**をクリック

3. **「アクセス権を付与」**ボタンをクリック

4. **新しいプリンシパル**:
   ```
   [プロジェクト番号]-compute@developer.gserviceaccount.com
   ```
   - 例: `123456789012-compute@developer.gserviceaccount.com`

5. **ロールを選択**:
   - 「Secret Manager Secret Accessor」を選択
   - または検索バーに「Secret Manager Secret Accessor」と入力

6. **「保存」**をクリック

**繰り返し対象のシークレット**:
1. `firebase-admin-private-key`
2. `firebase-admin-client-email`
3. `db-password`
4. `transaction-hub-api-key`
5. `google-genkit-api-key`
6. `api-register-password`
7. `jwt-secret`

---

### ステップ5: apphosting.staging.yaml を作成

#### 5.1 ローカルリポジトリで作業

1. **リポジトリのルートディレクトリ**に移動:
   ```
   /home/ktaka/GitHub/Customer/Nukune
   ```

2. **テキストエディタで新規ファイル作成**: `apphosting.staging.yaml`

3. **以下の内容をコピー＆ペースト**:

```yaml
# apphosting.staging.yaml
runConfig:
  minInstances: 0
  maxInstances: 10
  concurrency: 100
  cpu: 1
  memoryMiB: 4096

env:
  # ========================================
  # 🔑 公開情報（Firebase Client SDK）
  # ========================================
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSyAlz4JUgJS26U_vn5nj764FAmfs0QkonVM
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: nukune-stg01-475508.firebaseapp.com
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: nukune-stg01-475508
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: nukune-stg01-475508.firebasestorage.app
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "687518426651"
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: 1:687518426651:web:42713210ded2edcc927abe
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    value: G-83ETQR1EWM
    availability: [BUILD, RUNTIME]

  # ========================================
  # 🔐 シークレット（Secret Manager参照）
  # ========================================
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: nukune-stg01-475508
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

  # ========================================
  # 🗄️ MySQL / Cloud SQL
  # ========================================
  - variable: DB_HOST
    value: /cloudsql/nukune-stg:asia-northeast1:nukune-stg-mysql
    availability: RUNTIME

  - variable: DB_USER
    value: nukune_app
    availability: RUNTIME

  - variable: DB_PASSWORD
    secret: db-password
    availability: RUNTIME

  - variable: DB_NAME
    value: nukune_stg
    availability: RUNTIME

  - variable: DB_PORT
    value: "3306"
    availability: RUNTIME

  # ========================================
  # 💳 Transaction Hub API
  # ========================================
  - variable: TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  # ========================================
  # 🤖 Google Genkit
  # ========================================
  - variable: GOOGLE_GENKIT_API_KEY
    secret: google-genkit-api-key
    availability: [BUILD, RUNTIME]

  # ========================================
  # 🔒 セキュリティ
  # ========================================
  - variable: API_REGISTER_PASSWORD
    secret: api-register-password
    availability: RUNTIME

  - variable: JWT_SECRET
    secret: jwt-secret
    availability: RUNTIME

  - variable: ADMIN_EMAILS
    value: admin@example.com
    availability: RUNTIME

  - variable: NEXT_PUBLIC_ADMIN_EMAILS
    value: admin@example.com
    availability: [BUILD, RUNTIME]

  # ========================================
  # 🌐 外部サービス
  # ========================================
  - variable: NEXT_PUBLIC_RESERVATION_SITE_URL
    value: https://stg.nukipedia.jp
    availability: [BUILD, RUNTIME]

  # ========================================
  # ⚙️ その他
  # ========================================
  - variable: NODE_ENV
    value: production
    availability: [BUILD, RUNTIME]

# Cloud SQL接続設定
cloudSqlInstances:
  - connectionName: nukune-stg:asia-northeast1:nukune-stg-mysql
```

4. **ファイルを保存**

**重要なポイント**:

- ✅ **`secret: シークレット名`**: Secret Managerのシークレットを参照
- ✅ **`value: 値`**: 公開情報はそのまま記述（安全）
- ✅ **実際のシークレット値は含まれていない** → GitHubにプッシュしても安全

---

### ステップ6: GitHubにプッシュ

#### 6.1 Gitコマンドでプッシュ

ターミナルまたはGit Bashで実行:

```bash
cd /home/ktaka/GitHub/Customer/Nukune
git add apphosting.staging.yaml
git commit -m "feat: add apphosting.staging.yaml with Secret Manager references"
git push origin staging
```

#### 6.2 またはGitHub Desktopを使用

1. GitHub Desktopを開く
2. `apphosting.staging.yaml` が変更として表示される
3. コミットメッセージ: `feat: add apphosting.staging.yaml with Secret Manager references`
4. 「Commit to staging」をクリック
5. 「Push origin」をクリック

---

### ステップ7: デプロイとビルド確認

#### 7.1 Firebase Consoleでビルド確認

1. **Firebase Consoleを開く**
   ```
   https://console.firebase.google.com
   ```

2. **プロジェクトを選択**: `nukune-stg01-475508`

3. **App Hostingを開く**
   - 左メニュー → 「ビルド」 → 「App Hosting」

4. **バックエンドを選択**: `nukune-staging`

5. **ビルド履歴を確認**
   - 最新のビルドが自動的に開始されます（GitHubプッシュ後数秒）
   - ビルド状態: 「Running」 → 「Success」を確認

6. **ビルドログを確認**
   - ビルドをクリックして詳細ログを表示
   - 「Logs」タブで詳細確認

**成功の兆候**:
```
✓ Secrets loaded from Secret Manager
✓ Environment variables configured
✓ Firebase Admin SDK initialized successfully
✓ Generating static pages (45/45)
✓ Finalizing page optimization
Build completed successfully
```

**エラーの兆候**:
```
✗ Permission denied: Secret Manager access
✗ Secret not found: secret-name
✗ Firebase Admin SDK initialization failed
```

---

## 🐛 トラブルシューティング（コンソール版）

### エラー: "Permission denied: Secret Manager access"

**原因**: サービスアカウントに権限がない

**解決方法（コンソール）**:

1. **GCP Console > Secret Manager**を開く
2. 問題のシークレット（例: `firebase-admin-private-key`）をクリック
3. **「権限」タブ**をクリック
4. サービスアカウント（`[番号]-compute@developer.gserviceaccount.com`）が「Secret Manager Secret Accessor」ロールを持っているか確認
5. なければ「アクセス権を付与」で追加

### エラー: "Secret not found: secret-name"

**原因**: シークレットが作成されていない、または名前が間違っている

**解決方法（コンソール）**:

1. **GCP Console > Secret Manager**を開く
2. シークレット一覧で該当するシークレット名があるか確認
3. **名前が間違っている場合**:
   - `apphosting.staging.yaml`のシークレット名を修正
   - 例: `secret: firebase-admin-private-key`（ハイフンを確認）
4. **存在しない場合**:
   - 「シークレットを作成」で作成（上記手順参照）

### エラー: "FIREBASE_ADMIN_PRIVATE_KEY format invalid"

**原因**: 改行が正しく保存されていない、またはダブルクォートが含まれている

**解決方法（コンソール）**:

1. **Secret Manager**で`firebase-admin-private-key`をクリック
2. **「バージョン」タブ**で最新バージョンの「・・・」メニュー → 「削除」
3. **「新しいバージョン」**をクリック
4. **シークレットの値**を再入力:
   - Firebase JSONファイルから`private_key`をコピー
   - **ダブルクォート（`"`）を削除**
   - **`\n`はそのまま残す**（実際の改行に変換しない）
5. **「バージョンを追加」**

**正しい形式**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

### エラー: "Build fails with environment variable not found"

**原因**: `availability`が正しく設定されていない、またはタイポ

**解決方法**:

1. `apphosting.staging.yaml`を開く
2. ビルド時に必要な変数に`availability: [BUILD, RUNTIME]`が設定されているか確認:
   ```yaml
   - variable: FIREBASE_ADMIN_PRIVATE_KEY
     secret: firebase-admin-private-key
     availability: [BUILD, RUNTIME]  # BUILDが必要
   ```
3. 修正後、再度GitHubにプッシュ

---

## ✅ 最終確認チェックリスト

### Secret Manager
- [ ] Secret Manager APIが有効化されている
- [ ] 7つのシークレットがすべて作成されている:
  - [ ] `firebase-admin-private-key`
  - [ ] `firebase-admin-client-email`
  - [ ] `db-password`
  - [ ] `transaction-hub-api-key`
  - [ ] `google-genkit-api-key`
  - [ ] `api-register-password`
  - [ ] `jwt-secret`
- [ ] すべてのシークレットに権限が付与されている（`[番号]-compute@developer.gserviceaccount.com`）

### apphosting.staging.yaml
- [ ] ファイルがリポジトリのルートに作成されている
- [ ] すべてのシークレットが正しく参照されている（`secret: シークレット名`）
- [ ] `staging`ブランチにプッシュ済み

### ビルド・デプロイ
- [ ] Firebase App Hostingでビルドが成功
- [ ] ビルドログにエラーがない
- [ ] デプロイ完了

---

## 🔄 シークレットの更新方法（コンソール版）

シークレットを変更する場合（例: パスワード変更）：

1. **GCP Console > Secret Manager**を開く
2. 更新したいシークレット（例: `db-password`）をクリック
3. **「新しいバージョン」**ボタンをクリック
4. **新しいシークレットの値**を入力
5. **「バージョンを追加」**をクリック
6. **Firebase App Hostingで再デプロイ**:
   - 空のコミットをプッシュ、または
   - Firebase Console > App Hosting > 「Redeploy」

---

## 🧹 シークレットの削除（クリーンアップ）

テスト用のシークレットを削除する場合：

1. **GCP Console > Secret Manager**を開く
2. 削除したいシークレットの**チェックボックスをオン**
3. 上部の**「削除」**ボタンをクリック
4. 確認ダイアログで**「削除」**

---

## 📝 まとめ

### コンソールのみでのセットアップのメリット

- ✅ **CLIコマンド不要**: ブラウザだけで完結
- ✅ **視覚的**: UIで確認しながら作業可能
- ✅ **初心者にも優しい**: コマンドの知識不要
- ✅ **安全**: 実際のシークレット値はGitHubにプッシュされない

### 作業の流れ（まとめ）

1. ✅ Secret Manager APIを有効化（GCP Console）
2. ✅ 7つのシークレットを作成（GCP Console）
3. ✅ サービスアカウントに権限付与（GCP Console）
4. ✅ `apphosting.staging.yaml`を作成（ローカル）
5. ✅ `staging`ブランチにプッシュ
6. ✅ ビルド・デプロイ確認（Firebase Console）

---

## 🎯 次のステップ

シークレット設定が完了したら：

1. ✅ `apphosting.staging.yaml`を`staging`ブランチにプッシュ
2. ✅ Firebase Console > App Hosting でビルドログ確認
3. ✅ デプロイ成功を確認
4. ✅ アプリケーションにアクセスして動作確認

詳細は `BUILD_ERROR_FIX.md` の「ステップ4: 再デプロイ」を参照してください。

---

**Good luck! 🚀**
