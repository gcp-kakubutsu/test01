# setup.sh 使用ガイド

`setup.sh` は、Firebase App Hosting上にステージング環境を完全に自動構築するスクリプトです。

## 📋 事前準備: 必要なAPIキー

スクリプトを実行する前に、以下の2つのAPIキーを取得してください：

### 1. Google Genkit API Key（必須）

**用途:** AI機能（プロフィール検証など）に使用

**取得方法:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. Googleアカウントでログイン
3. "Create API Key" をクリック
4. APIキーをコピー（形式: `AIza...`）

**コスト:** 無料枠あり（詳細: https://ai.google.dev/pricing）

### 2. Transaction Hub API Key（必須）

**用途:** 決済処理とサブスクリプション管理

**取得方法:**
1. Transaction Hub ダッシュボードにアクセス
2. API Keys セクションに移動
3. "Create API Key" をクリック
4. ステージング環境用のキーを作成（形式: `stg_...`）

**注意:** 本番環境とステージング環境で別のキーを使用してください

### 自動生成される認証情報

以下は**スクリプトが自動生成**するため、事前準備は不要です：
- ✅ `API_REGISTER_PASSWORD` - 管理者登録用パスワード
- ✅ `JWT_SECRET` - JWT署名用シークレット
- ✅ `DATABASE_PASSWORD` - MySQLデータベースパスワード

---

## 🚀 クイックスタート

### 基本的な使い方

```bash
# スクリプトを実行可能にする
chmod +x docs_stg/setup.sh

# スクリプトを実行
./docs_stg/setup.sh
```

スクリプトが対話式で質問します：
1. GCPプロジェクトID
2. GCPプロジェクト名
3. GitHubリポジトリオーナー名
4. GitHubリポジトリ名
5. Google Genkit API Key（**スキップ可能 - Enterキーを押す**）
6. Transaction Hub API Key（**スキップ可能 - Enterキーを押す**）

### APIキーを後で追加

APIキーをスキップした場合：

```bash
# 後から追加できます
chmod +x docs_stg/update-api-keys.sh
./docs_stg/update-api-keys.sh
```

### 環境変数で自動化（上級者向け）

```bash
export PROJECT_ID="my-app-staging"
export GITHUB_REPO_OWNER="myusername"
export GITHUB_REPO_NAME="my-app"
export REGION="us-central1"

./docs_stg/setup.sh
```

---

## 📝 設定可能な環境変数

| 変数名 | 説明 | デフォルト値 | 例 |
|--------|------|--------------|-----|
| `PROJECT_ID` | GCPプロジェクトID | `nukune-staging-[timestamp]` | `my-app-staging-123` |
| `PROJECT_NAME` | GCPプロジェクト名 | `Nukune Staging` | `My App Staging` |
| `BILLING_ACCOUNT_ID` | 請求アカウントID | 自動検出 | `01234-5678AB-CDEF90` |
| `REGION` | デプロイリージョン | `asia-east1` | `us-central1`, `asia-southeast1` |
| `GITHUB_REPO_OWNER` | GitHubユーザー名/組織名 | 対話式入力 | `myusername`, `my-org` |
| `GITHUB_REPO_NAME` | GitHubリポジトリ名 | `Nukune` | `my-awesome-app` |
| `GIT_BRANCH` | デプロイブランチ | `staging` | `main`, `develop` |
| `CLOUD_SQL_INSTANCE` | Cloud SQLインスタンス名 | `nukune-mysql` | `my-app-db` |
| `DATABASE_NAME` | データベース名 | `nukune_db` | `myapp_db` |
| `DATABASE_USER` | データベースユーザー名 | `nukune_app` | `app_user` |
| `BACKEND_ID` | App HostingバックエンドID | `nukune-staging` | `my-app-backend` |
| `GOOGLE_GENKIT_API_KEY` | Genkit APIキー | 空（手動設定必要） | `AIza...` |
| `TRANSACTION_HUB_API_KEY` | Transaction Hub APIキー | 空（手動設定必要） | `sk_...` |

---

## 🌍 サポートされているリージョン

| リージョン | ロケーション | 最適な用途 |
|-----------|-------------|------------|
| `asia-east1` ⭐ | 台湾 | アジア/日本のユーザー |
| `us-central1` | アイオワ、米国 | 米国のユーザー |
| `asia-southeast1` | シンガポール | 東南アジアのユーザー |
| `europe-west4` | オランダ | ヨーロッパのユーザー |

**重要:** `asia-northeast1`（東京）はFirebase App Hostingでサポートされていません。

---

## 💡 使用例

### 例1: 対話式（推奨）

```bash
./docs_stg/setup.sh
```

プロンプトに従って入力するだけです。APIキーは後で追加できます。

### 例2: 環境変数で自動化

```bash
PROJECT_ID="myapp-staging" \
  GITHUB_REPO_OWNER="mycompany" \
  GITHUB_REPO_NAME="my-app" \
  REGION="us-central1" \
  ./docs_stg/setup.sh
```

### 例3: APIキーを後で追加

```bash
# 1. APIキーなしでセットアップ
./docs_stg/setup.sh
# → APIキープロンプトでEnterを押してスキップ

# 2. 後でAPIキーを追加
./docs_stg/update-api-keys.sh
```

---

## 🔧 スクリプトの動作

スクリプトは以下の12ステップを自動実行します：

1. ✅ **前提条件の確認** - gcloud, firebase, jq, Node.jsのインストール確認
2. ✅ **GCPプロジェクト作成** - 新規プロジェクトの作成と課金設定
3. ✅ **APIの有効化** - 必要なGCP APIを有効化
4. ✅ **Cloud SQL作成** - MySQLデータベースインスタンスの構築
5. ✅ **VPCネットワーク** - VPCコネクタの作成
6. ✅ **固定IP設定** - Cloud NATで固定IPを設定
7. ✅ **Firebase Admin認証情報** - サービスアカウントキーの取得（手動）
8. ✅ **Secret Manager** - 7つのシークレットを作成
9. ✅ **サービスアカウント権限** - 必要な権限を付与
10. ✅ **Firebase Config** - Webアプリの設定取得（手動）
11. ✅ **apphosting.yaml生成** - デプロイ設定ファイルの自動生成
12. ✅ **App Hosting設定** - GitHubリポジトリの接続（手動）

---

## 🔐 認証情報の保存

スクリプトは実行時に以下のファイルを生成します：

```
.env.setup.20251020_143022
```

このファイルには以下が含まれます：
- プロジェクトID
- データベースパスワード
- APIキー
- JWT Secret
- その他の機密情報

**重要:** このファイルは安全に保管してください！

---

## 📦 生成されるファイル

スクリプト実行後、以下のファイルが生成されます：

1. **apphosting.staging.yaml** - Firebase App Hosting設定ファイル
2. **.env.setup.YYYYMMDD_HHMMSS** - 認証情報ファイル
3. **firebase-admin-key.json** - Firebase Admin SDK認証情報（手動ダウンロード）
4. **firebase-config.json** - Firebase Web設定（手動作成）

これらのファイルは `.gitignore` に含まれており、Gitリポジトリにコミットされません。

---

## ⚠️ トラブルシューティング

### エラー: 請求アカウントが見つかりません

```bash
# 手動で請求アカウントIDを設定
export BILLING_ACCOUNT_ID="YOUR-BILLING-ACCOUNT-ID"
./docs_stg/setup.sh
```

請求アカウントIDは以下で確認できます：
```bash
gcloud billing accounts list
```

### エラー: プロジェクトIDが既に使用されています

プロジェクトIDはグローバルで一意である必要があります。別のIDを使用してください：

```bash
export PROJECT_ID="myapp-staging-$(date +%s)"
./docs_stg/setup.sh
```

### エラー: リージョンがサポートされていません

Firebase App Hostingがサポートするリージョンのみ使用できます：
- `asia-east1`（推奨）
- `us-central1`
- `asia-southeast1`
- `europe-west4`

---

## 🧹 クリーンアップ

作成したリソースを削除する場合：

### 方法1: プロジェクト全体を削除（推奨）

```bash
gcloud projects delete PROJECT_ID
```

### 方法2: 選択的に削除

詳細は [TEARDOWN.md](./TEARDOWN.md) を参照してください。

---

## 📞 サポート

問題が発生した場合：

1. スクリプトのエラーメッセージを確認
2. 前提条件がすべて満たされているか確認
3. [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) でよくあるエラーを確認
4. [FROM_SCRATCH.md](./FROM_SCRATCH.md) の手動手順を参照

---

**最終更新日:** 2025-10-20
