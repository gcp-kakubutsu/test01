# Nukune App Hosting セットアップガイド - ゼロから構築

このガイドでは、新しいGCPプロジェクトから始めて、Firebase App Hosting上でNukune（出会い系/マッチングアプリケーション）をゼロからセットアップする方法を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [リージョン選択](#リージョン選択)
4. [ステップバイステップセットアップ](#ステップバイステップセットアップ)
5. [検証](#検証)
6. [トラブルシューティング](#トラブルシューティング)

---

## 概要

**構築する内容:**

- 新しいGCPプロジェクト + Firebase
- Firebase App Hosting (Cloud Runベース)
- Cloud SQL (MySQL) データベース
- 固定IPを持つVPCネットワーク (Cloud NAT)
- Gitからの自動デプロイ

**アーキテクチャ:**

```
GitHub (stagingブランチ)
    ↓
Firebase App Hosting (ビルド)
    ↓
Cloud Run (asia-east1 または us-central1)
    ↓
VPCネットワーク → Cloud NAT → 固定IP
    ↓
Cloud SQL MySQL (同じリージョン)
```

**推定時間:** 2〜3時間

**推定コスト:** 月額 $50〜90 (ステージング環境、minInstances=0)

---

## 前提条件

### 必要なアカウント

- [ ] 課金が有効なGoogleアカウント
- [ ] リポジトリアクセス権を持つGitHubアカウント
- [ ] Firebase CLIのインストール (`npm install -g firebase-tools`)
- [ ] gcloud CLIのインストール ([インストールガイド](https://cloud.google.com/sdk/docs/install))

### 必要なAPIキー

- [ ] Google Genkit APIキー (AI機能用)
- [ ] Transaction Hub APIキー (決済処理用)

### ローカルツール

```bash
# ツールがインストールされているか確認
node --version  # v18.0.0以上
npm --version
firebase --version
gcloud --version
git --version
```

---

## リージョン選択

Firebase App Hostingは以下のリージョンをサポートしています（2025年10月時点）:

### このプロジェクトで推奨されるリージョン

| リージョン | 場所 | 日本からのレイテンシ | 最適な用途 |
|--------|------|------------------|----------|
| **asia-east1** | 台湾 | 〜50ms | **アジアユーザー向け（推奨）** |
| us-central1 | アメリカ・アイオワ | 〜150ms | アメリカユーザー向け |
| asia-southeast1 | シンガポール | 〜70ms | 東南アジア向け |
| europe-west4 | オランダ | 〜200ms | ヨーロッパ向け |

**重要:**

- `asia-northeast1` (東京) は Firebase App Hostingで**サポートされていません**
- すべてのリソース (Cloud Run、Cloud SQL、VPC) は**同じリージョン**に配置する必要があります
- デプロイ後のリージョン変更は、すべて再構築が必要です

**このガイドでは、アジアでの最適なパフォーマンスのため、デフォルトで `asia-east1` (台湾) を使用します。**

---

## ステップバイステップセットアップ

### ステップ1: 新しいGCPプロジェクトを作成

#### 1.1 コンソールでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. 「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. 詳細を入力:
   - **プロジェクト名:** `nukune-staging` (または任意の名前)
   - **プロジェクトID:** 自動生成されます (例: `nukune-staging-123456`)
   - **請求先アカウント:** 請求先アカウントを選択
4. 「作成」をクリック
5. **プロジェクトIDを保存** - このガイド全体で必要になります

#### 1.2 課金を有効化

1. [課金](https://console.cloud.google.com/billing) にアクセス
2. プロジェクトを請求先アカウントにリンク
3. 課金が有効になっていることを確認

---

### ステップ2: Firebaseプロジェクトの初期化

#### 2.1 Firebaseプロジェクトを作成

1. [Firebase Console](https://console.firebase.google.com) にアクセス
2. 「プロジェクトを追加」をクリック
3. 既存のGCPプロジェクト (`nukune-staging`) を選択
4. Google アナリティクスを有効化 (オプション、推奨)
5. 「続行」をクリック

#### 2.2 Firebaseサービスを有効化

**Authentication:**

1. Firebase Console → Authentication → 「始める」
2. ログイン方法 → 「メール/パスワード」を有効化
3. 「保存」をクリック

**Firestore:**

1. Firebase Console → Firestore Database → 「データベースを作成」
2. **本番モード**で開始
3. ロケーション: **asia-east1** (または選択したリージョン)
4. 「有効にする」をクリック

**Storage:**

1. Firebase Console → Storage → 「始める」
2. **本番モード**で開始 (ルールは後で設定)
3. ロケーション: **asia-east1** (Firestoreと同じ)
4. 「完了」をクリック

#### 2.3 Webアプリを登録

1. Firebase Console → プロジェクトの設定 → マイアプリ
2. Webアイコン (`</>`) をクリック
3. アプリのニックネーム: `Nukune Staging`
4. 「Firebase Hosting」はチェックしない
5. 「アプリを登録」をクリック
6. **Firebase configをコピー** - 後で環境変数として使用します:

   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:...",
     measurementId: "G-..."
   };
   ```

---

### ステップ3: Cloud SQLインスタンスを作成

#### 3.1 Cloud SQL APIを有効化

```bash
# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable sqladmin.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

#### 3.2 MySQLインスタンスを作成

**コンソール経由:**

1. GCP Console → SQL → 「インスタンスを作成」
2. 「MySQL」を選択
3. インスタンスID: `nukune-mysql`
4. パスワード: 強力なパスワードを生成 (保存してください!)
5. バージョン: MySQL 8.0
6. リージョン: **asia-east1** (または選択したリージョン)
7. ゾーン: シングルゾーン (ステージング用)
8. マシンタイプ: `db-n1-standard-2` (またはステージング用に小さいもの)
9. ストレージ: 10 GB SSD、自動サイズ変更を有効化
10. 「作成」をクリック

**5〜10分待ちます** - インスタンスが作成されるまで。

#### 3.3 データベースとユーザーを作成

```bash
# インスタンス名を設定
INSTANCE_NAME=nukune-mysql
PROJECT_ID=YOUR_PROJECT_ID

# データベースを作成
gcloud sql databases create nukune_db \
  --instance=$INSTANCE_NAME

# ユーザーを作成
gcloud sql users create nukune_app \
  --instance=$INSTANCE_NAME \
  --password=YOUR_SECURE_PASSWORD

# 接続名をメモ (後で必要になります)
gcloud sql instances describe $INSTANCE_NAME \
  --format="value(connectionName)"
# 出力: your-project-id:asia-east1:nukune-mysql
```

---

### ステップ4: VPCと固定IPのセットアップ

#### 4.1 VPCコネクタを作成

```bash
# REGIONを選択したリージョンに置き換え (asia-east1 または us-central1)
REGION=asia-east1
PROJECT_ID=YOUR_PROJECT_ID

gcloud compute networks vpc-access connectors create nukune-connector \
  --region=$REGION \
  --subnet-range=10.8.0.0/28 \
  --network=default \
  --min-instances=2 \
  --max-instances=10 \
  --project=$PROJECT_ID
```

#### 4.2 静的IPを予約

```bash
gcloud compute addresses create nukune-nat-ip \
  --region=$REGION \
  --project=$PROJECT_ID

# 予約されたIPを取得 (保存してください!)
gcloud compute addresses describe nukune-nat-ip \
  --region=$REGION \
  --format="value(address)"
```

#### 4.3 Cloud Routerを作成

```bash
gcloud compute routers create nukune-router \
  --network=default \
  --region=$REGION \
  --project=$PROJECT_ID
```

#### 4.4 Cloud NATを作成

```bash
gcloud compute routers nats create nukune-nat \
  --router=nukune-router \
  --region=$REGION \
  --nat-external-ip-pool=nukune-nat-ip \
  --nat-all-subnet-ip-ranges \
  --project=$PROJECT_ID
```

---

### ステップ5: Secret Managerの設定

#### 5.1 Secret Manager APIを有効化

```bash
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
```

#### 5.2 シークレットを作成

以下のシークレットを作成する必要があります。完全なスクリプトは `FROM_SCRATCH_CLI.md` を参照してください。

**必要なシークレット:**

1. `firebase-admin-client-email` - Firebaseサービスアカウントから
2. `firebase-admin-private-key` - Firebaseサービスアカウントから
3. `db-password` - MySQLパスワード
4. `transaction-hub-api-key` - 決済APIキー
5. `google-genkit-api-key` - AI APIキー
6. `api-register-password` - 登録APIパスワード
7. `jwt-secret` - JWT署名シークレット

**Firebase Admin認証情報を取得:**

1. Firebase Console → プロジェクトの設定 → サービスアカウント
2. 「新しい秘密鍵を生成」をクリック
3. JSONファイルを保存
4. JSONから `client_email` と `private_key` を抽出

---

### ステップ6: App Hostingの設定

#### 6.1 GitHubリポジトリに接続

1. Firebase Console → App Hosting → 「始める」
2. 「GitHubに接続」
3. Firebaseを承認
4. リポジトリを選択
5. アクセスを許可

#### 6.2 バックエンドを作成

1. 「バックエンドを作成」をクリック
2. 設定:
   - **バックエンドID:** `nukune-staging` (または任意の名前)
   - **ブランチ:** `staging`
   - **ルートディレクトリ:** `/`
3. 「次へ」をクリック

#### 6.3 apphosting.staging.yamlを作成

リポジトリのルートに `apphosting.staging.yaml` を作成:

```yaml
# apphosting.staging.yaml
runConfig:
  minInstances: 0
  maxInstances: 10
  concurrency: 100
  cpu: 1
  memoryMiB: 4096
  # 固定IP用のVPC設定
  vpcAccess:
    egress: ALL_TRAFFIC
    networkInterfaces:
      - network: projects/YOUR_PROJECT_ID/global/networks/default
        subnetwork: projects/YOUR_PROJECT_ID/regions/asia-east1/subnetworks/default

env:
  # Firebase Client SDK (公開)
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: YOUR_API_KEY
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: YOUR_PROJECT.firebaseapp.com
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: YOUR_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: YOUR_PROJECT.appspot.com
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "YOUR_SENDER_ID"
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: YOUR_APP_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    value: YOUR_MEASUREMENT_ID
    availability: [BUILD, RUNTIME]

  # Firebase Admin SDK (シークレット)
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: YOUR_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

  # MySQL設定
  - variable: DB_HOST
    value: /cloudsql/YOUR_PROJECT_ID:asia-east1:nukune-mysql
    availability: [RUNTIME]

  - variable: DB_USER
    value: nukune_app
    availability: [RUNTIME]

  - variable: DB_PASSWORD
    secret: db-password
    availability: [RUNTIME]

  - variable: DB_NAME
    value: nukune_db
    availability: [RUNTIME]

  - variable: DB_PORT
    value: "3306"
    availability: [RUNTIME]

  # APIキー
  - variable: TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_TRANSACTION_HUB_API_KEY
    secret: transaction-hub-api-key
    availability: [BUILD, RUNTIME]

  - variable: GOOGLE_GENKIT_API_KEY
    secret: google-genkit-api-key
    availability: [BUILD, RUNTIME]

  # セキュリティ
  - variable: API_REGISTER_PASSWORD
    secret: api-register-password
    availability: [RUNTIME]

  - variable: JWT_SECRET
    secret: jwt-secret
    availability: [RUNTIME]

  # その他
  - variable: NODE_ENV
    value: production
    availability: [BUILD, RUNTIME]

# Cloud SQL接続
cloudSqlInstances:
  - connectionName: YOUR_PROJECT_ID:asia-east1:nukune-mysql
```

#### 6.4 シークレットアクセスを付与

```bash
# バックエンドIDを取得
BACKEND_ID=nukune-staging  # または設定した名前

# すべてのシークレットへのアクセスを付与
firebase apphosting:secrets:grantaccess firebase-admin-client-email --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess firebase-admin-private-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess db-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess transaction-hub-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess google-genkit-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess api-register-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess jwt-secret --backend $BACKEND_ID --project $PROJECT_ID
```

#### 6.5 デプロイ

```bash
# コミットしてプッシュ
git checkout staging
git add apphosting.staging.yaml
git commit -m "feat: add App Hosting configuration"
git push origin staging
```

Firebase App Hostingがプッシュを自動的に検出してビルドを開始します。

---

## 検証

### ビルドステータスを確認

1. Firebase Console → App Hosting → ロールアウト
2. ビルドの進行状況を確認
3. ビルドは10〜15分で完了するはずです

### デプロイを確認

```bash
# Cloud Runサービスを確認
gcloud run services list --platform managed --region=$REGION

# ログを確認
gcloud logging read "resource.type=cloud_run_revision" --limit 50 --format=json
```

### 固定IPをテスト

```bash
# アウトバウンドIPは予約したNAT IPと一致するはずです
gcloud compute addresses list --filter="name=nukune-nat-ip"
```

---

## トラブルシューティング

### シークレットで「Permission Denied」が発生してビルドが失敗する

**原因:** サービスアカウントがSecret Managerアクセス権を持っていない

**解決策:**

```bash
# Cloud Buildサービスアカウントにプロジェクトレベルのアクセスを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

# サービスエージェントにも付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-YOUR_PROJECT_NUMBER@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None
```

### リージョン不一致でCloud Runが失敗する

**原因:** VPCサブネットのリージョンがデプロイリージョンと一致しない

**解決策:** すべてのリソースが同じリージョンにあることを確認:

- Cloud Runデプロイリージョン (App Hostingバックエンドの場所で決定)
- VPCサブネットリージョン
- Cloud SQLリージョン

### データベース接続が失敗する

**原因:** Cloud SQLインスタンスにアクセスできないか、接続文字列が間違っている

**解決策:**

```bash
# Cloud SQLインスタンスが実行中か確認
gcloud sql instances list

# 接続名の形式を確認
# 形式: PROJECT_ID:REGION:INSTANCE_NAME
gcloud sql instances describe nukune-mysql --format="value(connectionName)"
```

---

## 次のステップ

1. Firebaseセキュリティルールを設定 (Firestore、Storage)
2. モニタリングとアラートを設定
3. カスタムドメインを設定 (オプション)
4. 自動バックアップを設定
5. アプリケーション機能をテスト

---

## 関連ドキュメント

- [FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md) - 完全なCLIセットアップスクリプト
- [SECRET_MANAGER_SETUP.md](./SECRET_MANAGER_SETUP.md) - 詳細なシークレット設定
- [INFRASTRUCTURE_OVERVIEW.md](./INFRASTRUCTURE_OVERVIEW.md) - アーキテクチャの詳細
- [TEARDOWN.md](./TEARDOWN.md) - すべてを削除してコストを停止する方法

---

## コスト最適化

ステージング環境用:

```yaml
# apphosting.staging.yamlで
runConfig:
  minInstances: 0      # 未使用時にゼロにスケール
  maxInstances: 5      # 最大スケールを制限
  cpu: 1               # 低CPU
  memoryMiB: 2048      # 低メモリ
```

**Cloud SQL:**

- 小さいマシンタイプを使用 (`db-f1-micro` または `db-g1-small`)
- オフピーク時の自動シャットダウンをスケジュール
- 自動バックアップを無効化 (手動バックアップを使用)

**最適化による推定月額コスト:** $20〜40

---

**最終更新日:** 2025-10-20
