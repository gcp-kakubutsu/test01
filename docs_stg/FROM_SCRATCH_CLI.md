# ゼロから構築 - CLIセットアップスクリプト

このドキュメントでは、Nukuneアプリケーションのインフラストラクチャをゼロから構築するための完全なCLIコマンドを提供します。これらのスクリプトをコピー＆ペーストしてセットアッププロセスを自動化できます。

**対応するガイド:** [FROM_SCRATCH.md](./FROM_SCRATCH.md) - ステップバイステップの手動ガイド

## 目次

1. [前提条件](#前提条件)
2. [設定変数](#設定変数)
3. [アカウント設定](#アカウント設定)
4. [完全セットアップスクリプト](#完全セットアップスクリプト)
5. [シークレット作成スクリプト](#シークレット作成スクリプト)
6. [検証スクリプト](#検証スクリプト)
7. [クリーンアップスクリプト](#クリーンアップスクリプト)

---

## 前提条件

### 必要なツールのインストール

```bash
# gcloud CLIのインストール（まだの場合）
# https://cloud.google.com/sdk/docs/install

# Firebase CLIのインストール
npm install -g firebase-tools

# gcloudにログイン
gcloud auth login

# Firebaseにログイン
firebase login

# インストールの確認
gcloud --version
firebase --version
node --version  # v18以上である必要があります
```

---

## 設定変数

**このセクションをコピーして環境に合わせて値を変更してください:**

```bash
#!/bin/bash

# ===========================================
# プロジェクト設定
# ===========================================

# プロジェクト設定
export PROJECT_ID="nukune-staging-$(date +%s)"  # または独自のIDを使用
export PROJECT_NAME="Nukune Staging"
export BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"  # https://console.cloud.google.com/billing で確認

# リージョン選択（どちらか1つを選択）
# オプション1: アジア（台湾）- アジアユーザー向けに推奨
export REGION="asia-east1"
export CLOUD_SQL_REGION="asia-east1"

# オプション2: US Central
# export REGION="us-central1"
# export CLOUD_SQL_REGION="us-central1"

# GitHub設定
export GITHUB_REPO_OWNER="your-github-username"
export GITHUB_REPO_NAME="Nukune"
export GIT_BRANCH="staging"

# インフラストラクチャ名
export CLOUD_SQL_INSTANCE="nukune-mysql"
export DATABASE_NAME="nukune_db"
export DATABASE_USER="nukune_app"
export DATABASE_PASSWORD="$(openssl rand -base64 32)"  # 安全なパスワードを自動生成

export VPC_CONNECTOR_NAME="nukune-connector"
export CLOUD_ROUTER_NAME="nukune-router"
export NAT_IP_NAME="nukune-nat-ip"
export NAT_GATEWAY_NAME="nukune-nat"

export BACKEND_ID="nukune-staging"

# APIキー（これらを提供する必要があります）
export GOOGLE_GENKIT_API_KEY="your-genkit-api-key"
export TRANSACTION_HUB_API_KEY="your-transaction-hub-api-key"
export API_REGISTER_PASSWORD="$(openssl rand -base64 24)"
export JWT_SECRET="$(openssl rand -base64 48)"

# 設定をファイルに保存
echo "PROJECT_ID=$PROJECT_ID" > .env.setup
echo "DATABASE_PASSWORD=$DATABASE_PASSWORD" >> .env.setup
echo "API_REGISTER_PASSWORD=$API_REGISTER_PASSWORD" >> .env.setup
echo "JWT_SECRET=$JWT_SECRET" >> .env.setup
echo ""
echo "✅ 設定を .env.setup に保存しました"
echo "🔐 重要: これらの認証情報を安全に保存してください！"
cat .env.setup
```

---

## アカウント設定

### GCPアカウントの切り替え（必要な場合）

```bash
# 利用可能なアカウントをリスト表示
gcloud auth list

# 別のアカウントに切り替え
gcloud auth login --account=YOUR_EMAIL@gmail.com

# または新しいアカウントを追加
gcloud auth login --no-launch-browser

# 現在のアカウントを確認
gcloud config get-value account
```

### アクティブなプロジェクトを設定

```bash
# すべてのプロジェクトをリスト表示
gcloud projects list

# 別のプロジェクトに切り替え
gcloud config set project YOUR_PROJECT_ID

# 現在のプロジェクトを確認
gcloud config get-value project
```

---

## 完全セットアップスクリプト

**このスクリプトはインフラストラクチャ全体を作成します。上記の変数を設定した後に実行してください。**

```bash
#!/bin/bash
set -e  # エラー時に終了

# 設定を読み込み（ファイルに保存した場合）
source .env.setup 2>/dev/null || echo "環境変数を使用"

echo "=========================================="
echo "Nukuneインフラストラクチャセットアップ"
echo "=========================================="
echo "プロジェクトID: $PROJECT_ID"
echo "リージョン: $REGION"
echo "=========================================="
echo ""

# ===========================================
# ステップ1: GCPプロジェクトを作成
# ===========================================
echo "📦 ステップ1: GCPプロジェクトを作成中..."

gcloud projects create $PROJECT_ID \
  --name="$PROJECT_NAME" \
  --set-as-default

# 課金アカウントをリンク
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT_ID

echo "✅ プロジェクトが作成され、課金が有効になりました"
echo ""

# ===========================================
# ステップ2: 必要なAPIを有効化
# ===========================================
echo "🔌 ステップ2: APIを有効化中（数分かかる場合があります）..."

gcloud services enable \
  sqladmin.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  --project=$PROJECT_ID

echo "✅ APIが有効になりました"
echo ""

# ===========================================
# ステップ3: Cloud SQLインスタンスを作成
# ===========================================
echo "🗄️  ステップ3: Cloud SQLインスタンスを作成中..."

gcloud sql instances create $CLOUD_SQL_INSTANCE \
  --database-version=MYSQL_8_0 \
  --tier=db-n1-standard-2 \
  --region=$CLOUD_SQL_REGION \
  --root-password="$DATABASE_PASSWORD" \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --project=$PROJECT_ID

echo "⏳ Cloud SQLインスタンスの準備ができるまで待機中..."
gcloud sql operations wait \
  $(gcloud sql operations list --instance=$CLOUD_SQL_INSTANCE --limit=1 --format="value(name)") \
  --project=$PROJECT_ID

# データベースを作成
gcloud sql databases create $DATABASE_NAME \
  --instance=$CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID

# ユーザーを作成
gcloud sql users create $DATABASE_USER \
  --instance=$CLOUD_SQL_INSTANCE \
  --password="$DATABASE_PASSWORD" \
  --project=$PROJECT_ID

# 接続名を取得
export CLOUD_SQL_CONNECTION_NAME=$(gcloud sql instances describe $CLOUD_SQL_INSTANCE \
  --format="value(connectionName)" \
  --project=$PROJECT_ID)

echo "✅ Cloud SQLインスタンスが作成されました"
echo "   接続名: $CLOUD_SQL_CONNECTION_NAME"
echo ""

# ===========================================
# ステップ4: VPCネットワークをセットアップ
# ===========================================
echo "🌐 ステップ4: VPCネットワークをセットアップ中..."

# VPCコネクタを作成
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --subnet-range=10.8.0.0/28 \
  --network=default \
  --min-instances=2 \
  --max-instances=10 \
  --project=$PROJECT_ID

echo "✅ VPCコネクタが作成されました"
echo ""

# ===========================================
# ステップ5: Cloud NATで固定IPを設定
# ===========================================
echo "🔒 ステップ5: 固定IPを設定中..."

# 静的IPを予約
gcloud compute addresses create $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID

# 予約されたIPを取得
export STATIC_IP=$(gcloud compute addresses describe $NAT_IP_NAME \
  --region=$REGION \
  --format="value(address)" \
  --project=$PROJECT_ID)

echo "   予約されたIP: $STATIC_IP"

# Cloud Routerを作成
gcloud compute routers create $CLOUD_ROUTER_NAME \
  --network=default \
  --region=$REGION \
  --project=$PROJECT_ID

# Cloud NATを作成
gcloud compute routers nats create $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --nat-external-ip-pool=$NAT_IP_NAME \
  --nat-all-subnet-ip-ranges \
  --project=$PROJECT_ID

echo "✅ 固定IPが設定されました: $STATIC_IP"
echo ""

# ===========================================
# ステップ6: Firebase Admin認証情報を取得
# ===========================================
echo "🔥 ステップ6: Firebaseをセットアップ中..."
echo ""
echo "⚠️  手動ステップが必要です:"
echo "1. https://console.firebase.google.com にアクセス"
echo "2. プロジェクトにFirebaseを追加: $PROJECT_ID"
echo "3. プロジェクトの設定 → サービスアカウント に移動"
echo "4. '新しい秘密鍵を生成' をクリック"
echo "5. JSONファイルをこのディレクトリに 'firebase-admin-key.json' として保存"
echo ""
echo "このステップを完了したらEnterキーを押してください..."
read

# サービスアカウントキーから認証情報を抽出
if [ -f "firebase-admin-key.json" ]; then
  export FIREBASE_ADMIN_CLIENT_EMAIL=$(cat firebase-admin-key.json | jq -r '.client_email')
  export FIREBASE_ADMIN_PRIVATE_KEY=$(cat firebase-admin-key.json | jq -r '.private_key')
  echo "✅ Firebase認証情報を抽出しました"
else
  echo "❌ エラー: firebase-admin-key.json が見つかりません"
  exit 1
fi
echo ""

# ===========================================
# ステップ7: Secret Managerでシークレットを作成
# ===========================================
echo "🔐 ステップ7: Secret Managerでシークレットを作成中..."

# シークレットを作成
echo -n "$FIREBASE_ADMIN_CLIENT_EMAIL" | \
  gcloud secrets create firebase-admin-client-email \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$FIREBASE_ADMIN_PRIVATE_KEY" | \
  gcloud secrets create firebase-admin-private-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$DATABASE_PASSWORD" | \
  gcloud secrets create db-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$TRANSACTION_HUB_API_KEY" | \
  gcloud secrets create transaction-hub-api-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$GOOGLE_GENKIT_API_KEY" | \
  gcloud secrets create google-genkit-api-key \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$API_REGISTER_PASSWORD" | \
  gcloud secrets create api-register-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo -n "$JWT_SECRET" | \
  gcloud secrets create jwt-secret \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID

echo "✅ すべてのシークレットが作成されました"
echo ""

# ===========================================
# ステップ8: サービスアカウントにシークレットアクセスを付与
# ===========================================
echo "🔑 ステップ8: シークレットアクセスを付与中..."

# プロジェクト番号を取得
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Cloud Buildサービスアカウントにアクセスを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

echo "✅ サービスアカウントにシークレットアクセスが付与されました"
echo ""

# ===========================================
# ステップ9: Firebase Configを取得
# ===========================================
echo "🔥 ステップ9: Firebase設定を取得中..."
echo ""
echo "⚠️  手動ステップが必要です:"
echo "1. https://console.firebase.google.com/project/$PROJECT_ID/settings/general にアクセス"
echo "2. 'マイアプリ' の下で、Webアプリを追加"
echo "3. firebaseConfigオブジェクトをコピー"
echo "4. firebase-config.json に貼り付け"
echo ""
echo "このステップを完了したらEnterキーを押してください..."
read

if [ -f "firebase-config.json" ]; then
  export FIREBASE_API_KEY=$(cat firebase-config.json | jq -r '.apiKey')
  export FIREBASE_AUTH_DOMAIN=$(cat firebase-config.json | jq -r '.authDomain')
  export FIREBASE_PROJECT_ID=$(cat firebase-config.json | jq -r '.projectId')
  export FIREBASE_STORAGE_BUCKET=$(cat firebase-config.json | jq -r '.storageBucket')
  export FIREBASE_MESSAGING_SENDER_ID=$(cat firebase-config.json | jq -r '.messagingSenderId')
  export FIREBASE_APP_ID=$(cat firebase-config.json | jq -r '.appId')
  export FIREBASE_MEASUREMENT_ID=$(cat firebase-config.json | jq -r '.measurementId')
  echo "✅ Firebase設定を抽出しました"
else
  echo "❌ エラー: firebase-config.json が見つかりません"
  exit 1
fi
echo ""

# ===========================================
# ステップ10: apphosting.staging.yamlを生成
# ===========================================
echo "📝 ステップ10: apphosting.staging.yamlを生成中..."

cat > apphosting.staging.yaml <<EOF
# apphosting.staging.yaml
# $(date) に生成
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
      - network: projects/$PROJECT_ID/global/networks/default
        subnetwork: projects/$PROJECT_ID/regions/$REGION/subnetworks/default

env:
  # Firebase Client SDK（公開）
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: $FIREBASE_API_KEY
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: $FIREBASE_AUTH_DOMAIN
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: $FIREBASE_PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: $FIREBASE_STORAGE_BUCKET
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "$FIREBASE_MESSAGING_SENDER_ID"
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: $FIREBASE_APP_ID
    availability: [BUILD, RUNTIME]

  - variable: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    value: $FIREBASE_MEASUREMENT_ID
    availability: [BUILD, RUNTIME]

  # Firebase Admin SDK（シークレット）
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: $PROJECT_ID
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: firebase-admin-client-email
    availability: [BUILD, RUNTIME]

  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

  # MySQL設定
  - variable: DB_HOST
    value: /cloudsql/$CLOUD_SQL_CONNECTION_NAME
    availability: [RUNTIME]

  - variable: DB_USER
    value: $DATABASE_USER
    availability: [RUNTIME]

  - variable: DB_PASSWORD
    secret: db-password
    availability: [RUNTIME]

  - variable: DB_NAME
    value: $DATABASE_NAME
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

  - variable: NEXT_PUBLIC_RESERVATION_SITE_URL
    value: https://stg.nukipedia.jp
    availability: [BUILD, RUNTIME]

# Cloud SQL接続
cloudSqlInstances:
  - connectionName: $CLOUD_SQL_CONNECTION_NAME
EOF

echo "✅ apphosting.staging.yamlが作成されました"
echo ""

# ===========================================
# ステップ11: Firebase App Hostingをセットアップ
# ===========================================
echo "🚀 ステップ11: Firebase App Hostingをセットアップ中..."
echo ""
echo "⚠️  手動ステップが必要です:"
echo "1. https://console.firebase.google.com/project/$PROJECT_ID/apphosting にアクセス"
echo "2. '始める' をクリックしてGitHubに接続"
echo "3. リポジトリを選択: $GITHUB_REPO_OWNER/$GITHUB_REPO_NAME"
echo "4. バックエンドを作成:"
echo "   - バックエンドID: $BACKEND_ID"
echo "   - ブランチ: $GIT_BRANCH"
echo "   - ルートディレクトリ: /"
echo ""
echo "このステップを完了したらEnterキーを押してください..."
read

# App Hostingバックエンドにシークレットアクセスを付与
echo "🔑 App Hostingバックエンドにシークレットアクセスを付与中..."

firebase apphosting:secrets:grantaccess firebase-admin-client-email --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess firebase-admin-private-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess db-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess transaction-hub-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess google-genkit-api-key --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess api-register-password --backend $BACKEND_ID --project $PROJECT_ID
firebase apphosting:secrets:grantaccess jwt-secret --backend $BACKEND_ID --project $PROJECT_ID

echo "✅ シークレットアクセスが付与されました"
echo ""

# ===========================================
# セットアップ完了
# ===========================================
echo "=========================================="
echo "🎉 セットアップ完了！"
echo "=========================================="
echo ""
echo "プロジェクトID: $PROJECT_ID"
echo "リージョン: $REGION"
echo "固定IP: $STATIC_IP"
echo "Cloud SQL: $CLOUD_SQL_CONNECTION_NAME"
echo ""
echo "次のステップ:"
echo "1. apphosting.staging.yamlをリポジトリにコピー"
echo "2. $GIT_BRANCH ブランチにコミットしてプッシュ:"
echo "   git checkout $GIT_BRANCH"
echo "   git add apphosting.staging.yaml"
echo "   git commit -m 'feat: add App Hosting configuration'"
echo "   git push origin $GIT_BRANCH"
echo "3. Firebase App Hostingが自動的にビルドしてデプロイします"
echo ""
echo "📊 デプロイを監視:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo ""
echo "🔐 認証情報は .env.setup に保存されています"
echo "=========================================="
```

---

## シークレット作成スクリプト

**シークレットの作成/更新のみが必要な場合:**

```bash
#!/bin/bash

# 設定を読み込み
source .env.setup

# シークレットを作成または更新する関数
create_or_update_secret() {
  local SECRET_NAME=$1
  local SECRET_VALUE=$2

  # シークレットが存在するか確認
  if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    echo "シークレットを更新中: $SECRET_NAME"
    echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME \
      --data-file=- \
      --project=$PROJECT_ID
  else
    echo "シークレットを作成中: $SECRET_NAME"
    echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
      --data-file=- \
      --replication-policy=automatic \
      --project=$PROJECT_ID
  fi
}

# すべてのシークレットを作成/更新
create_or_update_secret "firebase-admin-client-email" "$FIREBASE_ADMIN_CLIENT_EMAIL"
create_or_update_secret "firebase-admin-private-key" "$FIREBASE_ADMIN_PRIVATE_KEY"
create_or_update_secret "db-password" "$DATABASE_PASSWORD"
create_or_update_secret "transaction-hub-api-key" "$TRANSACTION_HUB_API_KEY"
create_or_update_secret "google-genkit-api-key" "$GOOGLE_GENKIT_API_KEY"
create_or_update_secret "api-register-password" "$API_REGISTER_PASSWORD"
create_or_update_secret "jwt-secret" "$JWT_SECRET"

echo "✅ すべてのシークレットが作成/更新されました"
```

---

## 検証スクリプト

**セットアップを検証するには:**

```bash
#!/bin/bash

source .env.setup

echo "=========================================="
echo "インフラストラクチャ検証"
echo "=========================================="
echo ""

# プロジェクトを確認
echo "📦 プロジェクト:"
gcloud projects describe $PROJECT_ID --format="value(name,projectId,projectNumber)"
echo ""

# Cloud SQLを確認
echo "🗄️  Cloud SQL:"
gcloud sql instances list --project=$PROJECT_ID
echo ""

# VPCコネクタを確認
echo "🌐 VPCコネクタ:"
gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT_ID
echo ""

# 静的IPを確認
echo "🔒 静的IP:"
gcloud compute addresses list --filter="name=$NAT_IP_NAME" --project=$PROJECT_ID
echo ""

# Cloud NATを確認
echo "🌍 Cloud NAT:"
gcloud compute routers nats list --router=$CLOUD_ROUTER_NAME --region=$REGION --project=$PROJECT_ID
echo ""

# シークレットを確認
echo "🔐 シークレット:"
gcloud secrets list --project=$PROJECT_ID
echo ""

# Cloud Runサービスを確認
echo "🚀 Cloud Runサービス:"
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID
echo ""

echo "=========================================="
echo "✅ 検証完了"
echo "=========================================="
```

---

## クリーンアップスクリプト

**⚠️ 警告: これはすべてのリソースを削除します。注意して使用してください！**

```bash
#!/bin/bash

source .env.setup

echo "=========================================="
echo "⚠️  警告: リソースのクリーンアップ"
echo "=========================================="
echo "これは以下を削除します:"
echo "- プロジェクト: $PROJECT_ID"
echo "- すべてのCloud SQLデータベース"
echo "- すべてのVPCリソース"
echo "- すべてのシークレット"
echo "- すべてのCloud Runサービス"
echo ""
echo "確認するには 'DELETE' と入力してください:"
read CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "中止しました。"
  exit 1
fi

echo "リソースを削除中..."

# Cloud Runサービスを削除
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID --format="value(name)" | \
  xargs -I {} gcloud run services delete {} --platform=managed --region=$REGION --project=$PROJECT_ID --quiet

# Cloud NATを削除
gcloud compute routers nats delete $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Cloud Routerを削除
gcloud compute routers delete $CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# 静的IPを削除
gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# VPCコネクタを削除
gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# Cloud SQLインスタンスを削除
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet

# シークレットを削除
gcloud secrets delete firebase-admin-client-email --project=$PROJECT_ID --quiet
gcloud secrets delete firebase-admin-private-key --project=$PROJECT_ID --quiet
gcloud secrets delete db-password --project=$PROJECT_ID --quiet
gcloud secrets delete transaction-hub-api-key --project=$PROJECT_ID --quiet
gcloud secrets delete google-genkit-api-key --project=$PROJECT_ID --quiet
gcloud secrets delete api-register-password --project=$PROJECT_ID --quiet
gcloud secrets delete jwt-secret --project=$PROJECT_ID --quiet

echo "✅ すべてのリソースが削除されました"
echo ""
echo "プロジェクト全体を削除するには:"
echo "gcloud projects delete $PROJECT_ID"
```

---

## 一般的な操作

### ログを表示

```bash
# Cloud Runログ
gcloud run services logs read --platform=managed --region=$REGION --limit=50

# Cloud SQLログ
gcloud logging read "resource.type=cloudsql_database" --limit=50

# ビルドログ
gcloud builds list --limit=10
gcloud builds log BUILD_ID
```

### シークレットを更新

```bash
# シークレット値を更新
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# シークレットバージョンをリスト表示
gcloud secrets versions list SECRET_NAME

# シークレットにアクセス（デバッグ用）
gcloud secrets versions access latest --secret=SECRET_NAME
```

### データベース操作

```bash
# Cloud ShellでCloud SQLに接続
gcloud sql connect $CLOUD_SQL_INSTANCE --user=root

# またはローカルのMySQLクライアントで
gcloud sql connect $CLOUD_SQL_INSTANCE --user=$DATABASE_USER

# バックアップを作成
gcloud sql backups create --instance=$CLOUD_SQL_INSTANCE

# バックアップをリスト表示
gcloud sql backups list --instance=$CLOUD_SQL_INSTANCE
```

---

**最終更新日:** 2025-10-20
