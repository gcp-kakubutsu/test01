# セットアップ前の準備チェックリスト

このドキュメントでは、`setup.sh` スクリプトを実行する前に必要な準備をリストアップします。

## ✅ 準備チェックリスト

### 1. ツールのインストール

- [ ] **gcloud CLI** - [インストール手順](https://cloud.google.com/sdk/docs/install)
- [ ] **Firebase CLI** - `npm install -g firebase-tools`
- [ ] **jq** - JSON処理ツール
  - macOS: `brew install jq`
  - Ubuntu/Debian: `sudo apt-get install jq`
  - Windows: [jq公式サイト](https://stedolan.github.io/jq/download/)
- [ ] **Node.js v18以上** - [nodejs.org](https://nodejs.org/)

### 2. Googleアカウントと請求

- [ ] **Googleアカウント**（Gmail）
- [ ] **GCP請求アカウント**が有効
  - [GCP請求コンソール](https://console.cloud.google.com/billing)で確認
  - クレジットカード登録済み

### 3. 必須APIキーの取得

**📝 注意:** 以下の2つのAPIキーは、セキュリティ上の理由により**Web UIからのみ取得可能**です。
gcloud CLIや自動化スクリプトでは取得できません。必ずスクリプト実行前に手動で取得してください。

| 項目 | CLI自動化 | 理由 |
|------|----------|------|
| ✅ GCPプロジェクト作成 | 可能 | `gcloud projects create` |
| ✅ 請求アカウントID取得 | 可能 | `gcloud billing accounts list` |
| ✅ Cloud SQL作成 | 可能 | `gcloud sql instances create` |
| ✅ VPC/NAT設定 | 可能 | `gcloud compute` コマンド群 |
| ✅ Secret Manager | 可能 | `gcloud secrets create` |
| ❌ **Google Genkit API Key** | **不可能** | Google AI Studioポリシー |
| ❌ **Transaction Hub API Key** | **不可能** | 外部サービス |
| ⚠️ Firebase設定 | 一部手動 | コンソールでアプリ登録が必要 |

#### 🔑 Google Genkit API Key（必須）

**用途:** AI機能（プロフィール検証、画像分析など）

**⚠️ 重要:** このAPIキーは**Web UIからのみ取得可能**です。CLI経由では取得できません。

**取得手順（Web UI）:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. Googleアカウントでログイン
3. "Create API Key" をクリック
4. 新規プロジェクトまたは既存プロジェクトを選択
5. APIキーをコピー（形式: `AIza...`）

**保存先:** メモ帳やパスワードマネージャーに保存

**コスト情報:**
- 無料枠: 月15リクエスト（Gemini 2.0 Flash）
- 有料: リクエスト数に応じて課金
- 詳細: https://ai.google.dev/pricing

**サンプル:**
```
AIzaSyC1234567890abcdefghijklmnopqrstuv
```

**CLI代替手段:**
Google AI Studio APIキーの代わりに、Vertex AIとサービスアカウントを使用することも可能ですが、設定が複雑になります。初めての場合は上記のWeb UI経由でのAPIキー取得を推奨します。

---

#### 💳 Transaction Hub API Key（必須）

**用途:** 決済処理、サブスクリプション管理

**⚠️ 重要:** Transaction Hubは外部サービスのため、**Web UIからのみ取得可能**です。CLI経由では取得できません。

**取得手順（Web UI）:**
1. Transaction Hub にサインアップ/ログイン
2. ダッシュボードで "API Keys" セクションに移動
3. "Create API Key" をクリック
4. **環境を選択:** Staging（ステージング環境用）
5. APIキーをコピー（形式: `stg_...`）

**重要な注意事項:**
- ⚠️ ステージング環境用のキー（`stg_...`）を使用
- ⚠️ 本番環境（`prod_...`）とは別のキーを使用
- ⚠️ APIキーは秘密情報として扱う

**保存先:** メモ帳やパスワードマネージャーに保存

**サンプル:**
```
stg_1234567890abcdefghijklmnopqrstuvwxyz
```

**代替決済プロバイダー:**
Transaction Hub以外の決済プロバイダー（Stripe、PayPalなど）を使用する場合は、アプリケーションコードの修正が必要です。

---

### 4. GitHubリポジトリ情報

スクリプト実行時に以下の情報が必要です：

- [ ] **GitHubユーザー名/組織名** (例: `myusername`, `my-company`)
- [ ] **リポジトリ名** (例: `Nukune`, `my-awesome-app`)
- [ ] **デプロイブランチ** (例: `staging`, `main`)

**確認方法:**
```
GitHubリポジトリURL: https://github.com/[ユーザー名]/[リポジトリ名]
                                        ↑            ↑
                                    REPO_OWNER   REPO_NAME
```

---

### 5. プロジェクト情報の決定

以下の情報を事前に決めておくとスムーズです：

- [ ] **GCPプロジェクトID** (例: `myapp-staging-20251020`)
  - 6-30文字
  - 小文字、数字、ハイフンのみ
  - グローバルで一意である必要がある

- [ ] **GCPプロジェクト名** (例: `My App Staging Environment`)
  - 任意の表示名

- [ ] **デプロイリージョン** (推奨: `asia-east1` または `us-central1`)
  - `asia-east1` - アジア/日本ユーザー向け
  - `us-central1` - 米国ユーザー向け

---

## 🚀 セットアップ実行手順

### ステップ1: スクリプトを実行

```bash
# スクリプトを実行可能にする
chmod +x docs_stg/setup.sh

# スクリプトを実行
./docs_stg/setup.sh
```

### ステップ2: 質問に答える

スクリプトが以下を順次質問します：

1. **GCPプロジェクトID** (例: `myapp-staging-20251020`)
2. **GCPプロジェクト名** (例: `My App Staging`)
3. **GitHubリポジトリオーナー** (例: `myusername`)
4. **GitHubリポジトリ名** (例: `my-app`)
5. **Google Genkit API Key**
   - 取得済みの場合: APIキーを入力
   - まだの場合: **Enterキーを押してスキップ**
6. **Transaction Hub API Key**
   - 取得済みの場合: APIキーを入力
   - まだの場合: **Enterキーを押してスキップ**

### ステップ3: APIキーを後で追加（スキップした場合）

APIキーをスキップした場合、後から追加できます：

```bash
# 専用の更新スクリプトを使用
chmod +x docs_stg/update-api-keys.sh
./docs_stg/update-api-keys.sh
```

**注意:** APIキーがないと、AI機能と決済機能は動作しません。

---

## 🔧 高度な使い方

### 環境変数で自動化

```bash
export PROJECT_ID="myapp-staging"
export GITHUB_REPO_OWNER="myusername"
export GITHUB_REPO_NAME="my-app"
export REGION="asia-east1"
# APIキーは後で追加可能（オプション）
export GOOGLE_GENKIT_API_KEY="AIza..."
export TRANSACTION_HUB_API_KEY="stg_..."

./docs_stg/setup.sh
```

---

## 📝 自動生成される認証情報

以下は**スクリプトが自動生成**するため、事前準備は不要です：

| 項目 | 説明 | 生成方法 |
|------|------|---------|
| `DATABASE_PASSWORD` | MySQLデータベースのパスワード | `openssl rand -base64 32` |
| `API_REGISTER_PASSWORD` | 管理者API登録用パスワード | `openssl rand -base64 24` |
| `JWT_SECRET` | JWT署名用のシークレットキー | `openssl rand -base64 48` |

これらの値は、スクリプト実行後に `.env.setup.YYYYMMDD_HHMMSS` ファイルに保存されます。

---

## ⏱️ セットアップ所要時間

**合計: 約2-3時間**

- ツールのインストール: 10-15分
- APIキーの取得: 10-15分
- スクリプト実行: 30-45分
  - API有効化: 5分
  - Cloud SQL作成: 10-15分
  - VPC/NAT設定: 5分
  - Secret Manager: 5分
  - Firebase設定: 10分（手動）
- 検証とテスト: 30分-1時間

---

## 💰 推定コスト

**ステージング環境（最適化済み）:**
- Cloud SQL (db-n1-standard-2): $25-35/月
- Cloud Run (minInstances=0): $5-10/月
- VPC/NAT: $5-10/月
- Cloud Storage: $1-3/月
- その他（Secret Manager, Firestore等）: $2-5/月

**合計: 約 $40-60/月**

**コスト削減のヒント:**
- Cloud SQLインスタンスを `db-f1-micro` に変更: $15-20/月節約
- 使用しない時間帯にCloud SQLを停止: 最大50%削減
- 詳細は [TEARDOWN.md](./TEARDOWN.md) を参照

---

## ❓ よくある質問

### Q1: APIキーを持っていませんが、スクリプトを実行できますか？

いいえ。**Google Genkit API Key** と **Transaction Hub API Key** は必須です。スクリプト実行時にこれらのキーを入力する必要があります。

### Q2: Transaction Hubのアカウントがありません

Transaction Hubの代わりに別の決済プロバイダーを使用する場合は、スクリプトを手動で編集する必要があります。詳細は開発チームにお問い合わせください。

### Q3: 既存のGCPプロジェクトを使用できますか？

はい。スクリプト実行時に既存のプロジェクトIDを入力すると、既存プロジェクトを使用するか確認されます。

### Q4: APIキーを後から変更できますか？

はい。Secret Managerで以下のコマンドで更新できます：
```bash
echo -n "NEW_API_KEY" | gcloud secrets versions add google-genkit-api-key --data-file=-
echo -n "NEW_API_KEY" | gcloud secrets versions add transaction-hub-api-key --data-file=-
```

### Q5: APIキーの取得をCLIで自動化できませんか？

**いいえ、できません。** セキュリティ上の理由により、以下のAPIキーはWeb UIからのみ取得可能です：

- **Google Genkit API Key**: Google AI Studioのポリシーによりweb UIのみ
- **Transaction Hub API Key**: 外部サービスのため専用ダッシュボードのみ

**代替案:**
- 一度取得したAPIキーを環境変数やパスワードマネージャーに保存
- チーム内で共有する場合はSecret Managerを使用:
  ```bash
  # 一度手動で取得したキーをSecret Managerに保存
  echo -n "YOUR_API_KEY" | gcloud secrets create my-genkit-key --data-file=-

  # 他の環境で再利用
  export GOOGLE_GENKIT_API_KEY=$(gcloud secrets versions access latest --secret=my-genkit-key)
  ```

### Q6: billing アカウントIDはCLIで取得できますか？

**はい、できます！** setup.shスクリプトは自動的に取得します：
```bash
# 請求アカウントの一覧取得
gcloud billing accounts list

# アクティブな請求アカウントIDを自動取得
BILLING_ACCOUNT_ID=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)
```

---

## 📚 関連ドキュメント

- [setup.sh 使用ガイド](./SETUP_SCRIPT_USAGE.md) - スクリプトの詳細な使用方法
- [FROM_SCRATCH.md](./FROM_SCRATCH.md) - 手動セットアップ手順
- [TEARDOWN.md](./TEARDOWN.md) - インフラストラクチャの削除方法
- [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) - よくあるエラーと解決方法

---

**準備が完了したら:** [SETUP_SCRIPT_USAGE.md](./SETUP_SCRIPT_USAGE.md) を参照してスクリプトを実行してください。

**最終更新日:** 2025-10-20
