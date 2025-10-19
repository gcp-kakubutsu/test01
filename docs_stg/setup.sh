#!/bin/bash
# =============================================================================
# Nukune ステージング環境セットアップスクリプト
# =============================================================================
# このスクリプトは、Firebase App Hosting上にNukuneアプリケーションの
# ステージング環境を完全に構築します。
#
# 前提条件:
#   - gcloud CLI がインストールされている
#   - firebase CLI がインストールされている (npm install -g firebase-tools)
#   - jq がインストールされている (JSON処理用)
#   - 請求が有効なGoogleアカウント
#
# 必須APIキー（スクリプト実行前に取得してください）:
#   1. Google Genkit API Key
#      → https://aistudio.google.com/app/apikey で取得
#      → AI機能（プロフィール検証など）に使用
#
#   2. Transaction Hub API Key
#      → Transaction Hub ダッシュボードで取得
#      → 決済処理とサブスクリプション管理に使用
#
# 使用方法:
#   方法1: 対話式（推奨）
#     chmod +x setup.sh && ./setup.sh
#     → プロンプトに従って値を入力
#
#   方法2: 環境変数で設定
#     export PROJECT_ID="my-project-123"
#     export PROJECT_NAME="My Project"
#     export GITHUB_REPO_OWNER="myusername"
#     export GITHUB_REPO_NAME="my-repo"
#     export REGION="us-central1"
#     ./setup.sh
#
#   方法3: 一行で実行
#     PROJECT_ID="my-project" GITHUB_REPO_OWNER="user" GITHUB_REPO_NAME="repo" ./setup.sh
#
# 設定可能な環境変数:
#   PROJECT_ID               - GCPプロジェクトID (例: my-app-staging-123)
#   PROJECT_NAME             - GCPプロジェクト名 (例: My App Staging)
#   BILLING_ACCOUNT_ID       - 請求アカウントID (自動検出されます)
#   REGION                   - デプロイリージョン (デフォルト: asia-east1)
#   GITHUB_REPO_OWNER        - GitHubユーザー名または組織名
#   GITHUB_REPO_NAME         - GitHubリポジトリ名
#   GIT_BRANCH               - デプロイブランチ (デフォルト: staging)
#   CLOUD_SQL_INSTANCE       - Cloud SQLインスタンス名 (デフォルト: nukune-mysql)
#   DATABASE_NAME            - データベース名 (デフォルト: nukune_db)
#   DATABASE_USER            - データベースユーザー名 (デフォルト: nukune_app)
#   BACKEND_ID               - App HostingバックエンドID (デフォルト: nukune-staging)
#   GOOGLE_GENKIT_API_KEY    - Genkit APIキー
#   TRANSACTION_HUB_API_KEY  - Transaction Hub APIキー
#
# 生成日: $(date)
# =============================================================================

set -e  # エラー時に終了

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルパー関数
print_step() {
  echo ""
  echo -e "${BLUE}=========================================="
  echo -e "$1"
  echo -e "==========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# =============================================================================
# GCPアカウントの確認（最初に実行）
# =============================================================================
print_step "GCPアカウントの確認"

# gcloud CLIの確認
if ! command -v gcloud &> /dev/null; then
  print_error "gcloud CLIがインストールされていません"
  print_info "https://cloud.google.com/sdk/docs/install からインストールしてください"
  exit 1
fi

# 認証状態の確認
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
  print_warning "gcloudにログインしていません"
  echo -e "${YELLOW}ログインしますか？ (yes/no)${NC}"
  read -r DO_LOGIN
  if [ "$DO_LOGIN" = "yes" ]; then
    gcloud auth login
  else
    print_error "gcloudへのログインが必要です"
    exit 1
  fi
fi

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
print_info "現在のアカウント: $ACTIVE_ACCOUNT"

# 利用可能なアカウントを表示
echo ""
echo -e "${BLUE}利用可能なGCPアカウント:${NC}"
gcloud auth list

echo ""
echo -e "${YELLOW}このアカウントでセットアップを続行しますか？ (yes/no)${NC}"
echo -e "${BLUE}別のアカウントに切り替える場合は 'no' を選択してください${NC}"
read -r CONFIRM_ACCOUNT

if [ "$CONFIRM_ACCOUNT" != "yes" ]; then
  echo ""
  echo -e "${YELLOW}アカウントを切り替えますか？ (yes/no)${NC}"
  read -r SWITCH_ACCOUNT

  if [ "$SWITCH_ACCOUNT" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}使用するアカウントのメールアドレスを入力してください:${NC}"
    read -r NEW_ACCOUNT

    # アカウントが既に認証済みかチェック
    if gcloud auth list --format="value(account)" | grep -q "^${NEW_ACCOUNT}$"; then
      print_info "既存のアカウントに切り替え中..."
      gcloud config set account "$NEW_ACCOUNT"
    else
      print_info "新しいアカウントでログイン中..."
      gcloud auth login --account="$NEW_ACCOUNT"
    fi

    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    print_success "アカウントを切り替えました: $ACTIVE_ACCOUNT"
  else
    print_error "セットアップを中止しました"
    exit 0
  fi
fi

print_success "使用するアカウント: $ACTIVE_ACCOUNT"
echo ""

# =============================================================================
# 設定変数
# =============================================================================
print_step "設定変数の読み込み"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 事前準備の確認${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "このスクリプトは大部分を自動化しますが、以下の2つのAPIキーは"
echo "セキュリティ上の理由により手動で取得する必要があります："
echo ""
echo "  1️⃣  Google Genkit API Key"
echo "     → https://aistudio.google.com/app/apikey"
echo ""
echo "  2️⃣  Transaction Hub API Key"
echo "     → Transaction Hub ダッシュボード"
echo ""
echo -e "${GREEN}✅ APIキーを取得済み → 後で入力できます${NC}"
echo -e "${GREEN}✅ APIキーがまだない → Enterキーでスキップして後で追加${NC}"
echo -e "${BLUE}   （update-api-keys.sh スクリプトで後から更新可能）${NC}"
echo ""
echo -e "${YELLOW}詳細: docs_stg/PREREQUISITES.md${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# プロジェクト設定（対話式または環境変数）
if [ -z "$PROJECT_ID" ]; then
  DEFAULT_PROJECT_ID="nukune-staging-$(date +%s)"
  echo -e "${YELLOW}GCPプロジェクトIDを入力してください (デフォルト: $DEFAULT_PROJECT_ID):${NC}"
  read -r PROJECT_ID
  PROJECT_ID="${PROJECT_ID:-$DEFAULT_PROJECT_ID}"
fi

if [ -z "$PROJECT_NAME" ]; then
  echo -e "${YELLOW}GCPプロジェクト名を入力してください (デフォルト: Nukune Staging):${NC}"
  read -r PROJECT_NAME
  PROJECT_NAME="${PROJECT_NAME:-Nukune Staging}"
fi

# 請求アカウントID（自動取得または手動設定）
if [ -z "$BILLING_ACCOUNT_ID" ]; then
  print_info "請求アカウントを取得中..."
  BILLING_ACCOUNT_ID=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)
  if [ -z "$BILLING_ACCOUNT_ID" ]; then
    print_error "請求アカウントが見つかりません"
    print_info "https://console.cloud.google.com/billing で請求を有効にしてください"
    exit 1
  fi
fi

# リージョン選択（asia-east1 または us-central1）
REGION="${REGION:-asia-east1}"
CLOUD_SQL_REGION="${CLOUD_SQL_REGION:-$REGION}"

# GitHub設定（環境変数で設定するか、対話式で入力）
if [ -z "$GITHUB_REPO_OWNER" ]; then
  echo -e "${YELLOW}GitHubリポジトリオーナー名を入力してください:${NC}"
  read -r GITHUB_REPO_OWNER
fi

if [ -z "$GITHUB_REPO_NAME" ]; then
  echo -e "${YELLOW}GitHubリポジトリ名を入力してください (デフォルト: Nukune):${NC}"
  read -r GITHUB_REPO_NAME
  GITHUB_REPO_NAME="${GITHUB_REPO_NAME:-Nukune}"
fi

GIT_BRANCH="${GIT_BRANCH:-staging}"

# インフラストラクチャ名
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-nukune-mysql}"
DATABASE_NAME="${DATABASE_NAME:-nukune_db}"
DATABASE_USER="${DATABASE_USER:-nukune_app}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-$(openssl rand -base64 32)}"

VPC_CONNECTOR_NAME="${VPC_CONNECTOR_NAME:-nukune-connector}"
CLOUD_ROUTER_NAME="${CLOUD_ROUTER_NAME:-nukune-router}"
NAT_IP_NAME="${NAT_IP_NAME:-nukune-nat-ip}"
NAT_GATEWAY_NAME="${NAT_GATEWAY_NAME:-nukune-nat}"

BACKEND_ID="${BACKEND_ID:-nukune-staging}"

# APIキー（オプション: 後で追加可能）
# ⚠️ GOOGLE_GENKIT_API_KEY: Google AI Studio (https://aistudio.google.com/app/apikey) で取得
# ⚠️ TRANSACTION_HUB_API_KEY: Transaction Hub ダッシュボードで取得
if [ -z "$GOOGLE_GENKIT_API_KEY" ]; then
  echo -e "${YELLOW}Google Genkit API Key を入力してください:${NC}"
  echo -e "${BLUE}取得先: https://aistudio.google.com/app/apikey${NC}"
  echo -e "${GREEN}※ 後で追加する場合は空白のままEnterを押してください${NC}"
  read -r GOOGLE_GENKIT_API_KEY

  if [ -z "$GOOGLE_GENKIT_API_KEY" ]; then
    # Generate a mock API key that won't cause build failures
    # Format similar to real Google API keys: AIza followed by random characters
    GOOGLE_GENKIT_API_KEY="AIza_MOCK_KEY_$(openssl rand -hex 16)"
    print_warning "Google Genkit API Keyはモックキーで設定されました（後で実際のキーに置き換えてください）"
  fi
fi

if [ -z "$TRANSACTION_HUB_API_KEY" ]; then
  echo -e "${YELLOW}Transaction Hub API Key を入力してください:${NC}"
  echo -e "${GREEN}※ 後で追加する場合は空白のままEnterを押してください${NC}"
  read -r TRANSACTION_HUB_API_KEY

  if [ -z "$TRANSACTION_HUB_API_KEY" ]; then
    # Generate a mock API key that won't cause build failures
    # Format similar to Transaction Hub keys
    TRANSACTION_HUB_API_KEY="mock_api_key_$(openssl rand -hex 24)"
    print_warning "Transaction Hub API Keyはモックキーで設定されました（後で実際のキーに置き換えてください）"
  fi
fi

# セキュリティキー（自動生成）
API_REGISTER_PASSWORD="${API_REGISTER_PASSWORD:-$(openssl rand -base64 24)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48)}"

# 設定を表示
print_info "プロジェクトID: $PROJECT_ID"
print_info "リージョン: $REGION"
print_info "請求アカウント: $BILLING_ACCOUNT_ID"
print_info "GitHubリポジトリ: $GITHUB_REPO_OWNER/$GITHUB_REPO_NAME ($GIT_BRANCH)"

# 確認
echo ""
echo -e "${YELLOW}この設定で続行しますか？ (yes/no)${NC}"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  print_warning "中止しました"
  exit 0
fi

# 認証情報を保存
CREDENTIALS_FILE=".env.setup.$(date +%Y%m%d_%H%M%S)"
cat > "$CREDENTIALS_FILE" <<EOF
# Nukune ステージング環境 認証情報
# 生成日: $(date)
# 🔐 重要: このファイルを安全に保管してください！

GCP_ACCOUNT=$ACTIVE_ACCOUNT
PROJECT_ID=$PROJECT_ID
BILLING_ACCOUNT_ID=$BILLING_ACCOUNT_ID
REGION=$REGION
DATABASE_PASSWORD=$DATABASE_PASSWORD
API_REGISTER_PASSWORD=$API_REGISTER_PASSWORD
JWT_SECRET=$JWT_SECRET
GOOGLE_GENKIT_API_KEY=$GOOGLE_GENKIT_API_KEY
TRANSACTION_HUB_API_KEY=$TRANSACTION_HUB_API_KEY
EOF

print_success "設定を $CREDENTIALS_FILE に保存しました"

# =============================================================================
# ステップ1: 前提条件の確認
# =============================================================================
print_step "ステップ1: 前提条件の確認"

# Firebase CLIの確認
if ! command -v firebase &> /dev/null; then
  print_error "Firebase CLIがインストールされていません"
  print_info "npm install -g firebase-tools でインストールしてください"
  exit 1
fi
print_success "Firebase CLI: $(firebase --version)"

# jqの確認
if ! command -v jq &> /dev/null; then
  print_error "jqがインストールされていません"
  print_info "JSON処理に必要です"
  exit 1
fi
print_success "jq: $(jq --version)"

# Node.jsの確認
if ! command -v node &> /dev/null; then
  print_error "Node.jsがインストールされていません"
  exit 1
fi
NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  print_error "Node.js v18以上が必要です (現在: v$NODE_VERSION)"
  exit 1
fi
print_success "Node.js: $(node --version)"

# =============================================================================
# ステップ2: GCPプロジェクトの作成
# =============================================================================
print_step "ステップ2: GCPプロジェクトの作成"

# プロジェクトが既に存在するか確認
if gcloud projects describe "$PROJECT_ID" &> /dev/null; then
  print_warning "プロジェクト $PROJECT_ID は既に存在します"
  echo "既存のプロジェクトを使用しますか？ (yes/no)"
  read -r USE_EXISTING
  if [ "$USE_EXISTING" != "yes" ]; then
    print_error "別のPROJECT_IDを設定してください"
    exit 1
  fi
else
  print_info "プロジェクトを作成中: $PROJECT_ID"
  gcloud projects create "$PROJECT_ID" \
    --name="$PROJECT_NAME" \
    --set-as-default

  print_success "プロジェクトが作成されました"
fi

# 課金アカウントをリンク
print_info "課金アカウントの状態を確認中..."
CURRENT_BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -n "$CURRENT_BILLING" ]; then
  print_success "課金アカウントは既にリンクされています: $CURRENT_BILLING"

  # 指定された課金アカウントと異なる場合は警告
  if [[ "$CURRENT_BILLING" != *"$BILLING_ACCOUNT_ID"* ]]; then
    print_warning "異なる課金アカウントがリンクされています"
    echo -e "${YELLOW}現在: $CURRENT_BILLING${NC}"
    echo -e "${YELLOW}指定: $BILLING_ACCOUNT_ID${NC}"
    echo -e "${YELLOW}課金アカウントを変更しますか？ (yes/no)${NC}"
    read -r CHANGE_BILLING
    if [ "$CHANGE_BILLING" = "yes" ]; then
      print_info "課金アカウントを変更中..."
      gcloud billing projects link "$PROJECT_ID" \
        --billing-account="$BILLING_ACCOUNT_ID"
      print_success "課金アカウントが変更されました"
    else
      print_info "既存の課金アカウントを使用します"
      BILLING_ACCOUNT_ID="$CURRENT_BILLING"
    fi
  fi
else
  print_info "課金アカウントをリンク中..."
  gcloud billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT_ID"
  print_success "課金が有効になりました"
fi

# アクティブプロジェクトとして設定
gcloud config set project "$PROJECT_ID"

# =============================================================================
# ステップ3: 必要なAPIの有効化
# =============================================================================
print_step "ステップ3: 必要なAPIの有効化"

print_info "APIを有効化中（数分かかる場合があります）..."

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
  --project="$PROJECT_ID"

print_success "すべてのAPIが有効になりました"

# =============================================================================
# ステップ4: Cloud SQLインスタンスの作成
# =============================================================================
print_step "ステップ4: Cloud SQLインスタンスの作成"

# 既存のインスタンスを確認
if gcloud sql instances describe "$CLOUD_SQL_INSTANCE" --project="$PROJECT_ID" &> /dev/null; then
  print_warning "Cloud SQLインスタンス $CLOUD_SQL_INSTANCE は既に存在します"
  print_info "既存のインスタンスを使用します"
else
  print_info "Cloud SQLインスタンスを作成中（10-15分かかります）..."

  gcloud sql instances create "$CLOUD_SQL_INSTANCE" \
    --database-version=MYSQL_8_0 \
    --tier=db-n1-standard-2 \
    --region="$CLOUD_SQL_REGION" \
    --root-password="$DATABASE_PASSWORD" \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --project="$PROJECT_ID"

  print_info "Cloud SQLインスタンスの準備ができるまで待機中..."
  sleep 10  # 少し待つ

  print_success "Cloud SQLインスタンスが作成されました"
fi

# データベースを作成
if ! gcloud sql databases describe "$DATABASE_NAME" --instance="$CLOUD_SQL_INSTANCE" --project="$PROJECT_ID" &> /dev/null; then
  print_info "データベースを作成中: $DATABASE_NAME"
  gcloud sql databases create "$DATABASE_NAME" \
    --instance="$CLOUD_SQL_INSTANCE" \
    --project="$PROJECT_ID"
  print_success "データベースが作成されました"
fi

# ユーザーを作成
if ! gcloud sql users list --instance="$CLOUD_SQL_INSTANCE" --project="$PROJECT_ID" | grep -q "$DATABASE_USER"; then
  print_info "データベースユーザーを作成中: $DATABASE_USER"
  gcloud sql users create "$DATABASE_USER" \
    --instance="$CLOUD_SQL_INSTANCE" \
    --password="$DATABASE_PASSWORD" \
    --project="$PROJECT_ID"
  print_success "ユーザーが作成されました"
fi

# 接続名を取得
CLOUD_SQL_CONNECTION_NAME=$(gcloud sql instances describe "$CLOUD_SQL_INSTANCE" \
  --format="value(connectionName)" \
  --project="$PROJECT_ID")

print_success "Cloud SQL接続名: $CLOUD_SQL_CONNECTION_NAME"

# =============================================================================
# ステップ5: VPCネットワークのセットアップ
# =============================================================================
print_step "ステップ5: VPCネットワークのセットアップ"

# VPCコネクタを作成
if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR_NAME" \
  --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
  print_warning "VPCコネクタ $VPC_CONNECTOR_NAME は既に存在します"
else
  print_info "VPCコネクタを作成中..."
  gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR_NAME" \
    --region="$REGION" \
    --range=10.8.0.0/28 \
    --network=default \
    --min-instances=2 \
    --max-instances=10 \
    --project="$PROJECT_ID"

  print_success "VPCコネクタが作成されました"
fi

# =============================================================================
# ステップ6: Cloud NATで固定IPを設定
# =============================================================================
print_step "ステップ6: 固定IPの設定（Cloud NAT）"

# 静的IPを予約
if gcloud compute addresses describe "$NAT_IP_NAME" \
  --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
  print_warning "静的IP $NAT_IP_NAME は既に存在します"
else
  print_info "静的IPを予約中..."
  gcloud compute addresses create "$NAT_IP_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID"
fi

# 予約されたIPを取得
STATIC_IP=$(gcloud compute addresses describe "$NAT_IP_NAME" \
  --region="$REGION" \
  --format="value(address)" \
  --project="$PROJECT_ID")

print_success "予約されたIP: $STATIC_IP"

# Cloud Routerを作成
if gcloud compute routers describe "$CLOUD_ROUTER_NAME" \
  --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
  print_warning "Cloud Router $CLOUD_ROUTER_NAME は既に存在します"
else
  print_info "Cloud Routerを作成中..."
  gcloud compute routers create "$CLOUD_ROUTER_NAME" \
    --network=default \
    --region="$REGION" \
    --project="$PROJECT_ID"

  print_success "Cloud Routerが作成されました"
fi

# Cloud NATを作成
if gcloud compute routers nats describe "$NAT_GATEWAY_NAME" \
  --router="$CLOUD_ROUTER_NAME" --region="$REGION" --project="$PROJECT_ID" &> /dev/null; then
  print_warning "Cloud NAT $NAT_GATEWAY_NAME は既に存在します"
else
  print_info "Cloud NATを作成中..."
  gcloud compute routers nats create "$NAT_GATEWAY_NAME" \
    --router="$CLOUD_ROUTER_NAME" \
    --region="$REGION" \
    --nat-external-ip-pool="$NAT_IP_NAME" \
    --nat-all-subnet-ip-ranges \
    --project="$PROJECT_ID"

  print_success "Cloud NATが作成されました"
fi

# =============================================================================
# ステップ7: Firebase Admin認証情報の取得
# =============================================================================
print_step "ステップ7: Firebase Admin認証情報の取得"

print_warning "手動ステップが必要です！"
echo ""
echo "以下の手順を実行してください："
echo "1. https://console.firebase.google.com にアクセス"
echo "2. 'プロジェクトを追加' をクリック"
echo "3. '既存のGoogleプロジェクトを選択' で $PROJECT_ID を選択"
echo "4. Firebaseを追加"
echo "5. プロジェクトの設定 → サービスアカウント に移動"
echo "6. '新しい秘密鍵を生成' をクリック"
echo "7. JSONファイルを 'firebase-admin-key.json' として現在のディレクトリに保存"
echo ""
echo -e "${YELLOW}完了したら 'yes' と入力してください:${NC}"
read -r FIREBASE_DONE

if [ "$FIREBASE_DONE" != "yes" ]; then
  print_error "Firebase設定がキャンセルされました"
  exit 1
fi

# サービスアカウントキーから認証情報を抽出
if [ ! -f "firebase-admin-key.json" ]; then
  print_error "firebase-admin-key.json が見つかりません"
  exit 1
fi

FIREBASE_ADMIN_CLIENT_EMAIL=$(jq -r '.client_email' firebase-admin-key.json)
FIREBASE_ADMIN_PRIVATE_KEY=$(jq -r '.private_key' firebase-admin-key.json)

print_success "Firebase Admin認証情報を抽出しました"

# 認証情報ファイルに追加
cat >> "$CREDENTIALS_FILE" <<EOF
FIREBASE_ADMIN_CLIENT_EMAIL=$FIREBASE_ADMIN_CLIENT_EMAIL
EOF

# =============================================================================
# ステップ8: Secret Managerでシークレットを作成
# =============================================================================
print_step "ステップ8: Secret Managerでシークレットを作成"

# シークレットを作成する関数
create_secret() {
  local SECRET_NAME=$1
  local SECRET_VALUE=$2

  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &> /dev/null; then
    print_info "シークレット $SECRET_NAME を更新中..."
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
      --data-file=- \
      --project="$PROJECT_ID"
  else
    print_info "シークレット $SECRET_NAME を作成中..."
    echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
      --data-file=- \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
  fi
}

create_secret "firebase-admin-client-email" "$FIREBASE_ADMIN_CLIENT_EMAIL"
create_secret "firebase-admin-private-key" "$FIREBASE_ADMIN_PRIVATE_KEY"
create_secret "db-password" "$DATABASE_PASSWORD"
create_secret "transaction-hub-api-key" "$TRANSACTION_HUB_API_KEY"
create_secret "google-genkit-api-key" "$GOOGLE_GENKIT_API_KEY"
create_secret "api-register-password" "$API_REGISTER_PASSWORD"
create_secret "jwt-secret" "$JWT_SECRET"

print_success "すべてのシークレットが作成されました"

# =============================================================================
# ステップ9: サービスアカウントにシークレットアクセスを付与
# =============================================================================
print_step "ステップ9: サービスアカウント権限の設定"

# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

print_info "プロジェクト番号: $PROJECT_NUMBER"

# Cloud Buildサービスアカウントにアクセスを付与
print_info "Cloud Buildサービスアカウントに権限を付与中..."

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

print_success "サービスアカウントに権限が付与されました"

# =============================================================================
# ステップ10: Firebase Configの取得
# =============================================================================
print_step "ステップ10: Firebase Configの取得"

print_warning "手動ステップが必要です！"
echo ""
echo "以下の手順を実行してください："
echo "1. https://console.firebase.google.com/project/$PROJECT_ID/settings/general にアクセス"
echo "2. 'マイアプリ' セクションで '</>' (Web) アイコンをクリック"
echo "3. アプリのニックネームを入力（例: Nukune Web）"
echo "4. 'アプリを登録' をクリック"
echo "5. firebaseConfig オブジェクトをコピー"
echo "6. 以下のような形式で 'firebase-config.json' に保存:"
echo ""
echo '{'
echo '  "apiKey": ".....",'
echo '  "authDomain": ".....",'
echo '  "projectId": ".....",'
echo '  "storageBucket": ".....",'
echo '  "messagingSenderId": ".....",'
echo '  "appId": ".....",'
echo '  "measurementId": "....."'
echo '}'
echo ""
echo -e "${YELLOW}完了したら 'yes' と入力してください:${NC}"
read -r CONFIG_DONE

if [ "$CONFIG_DONE" != "yes" ]; then
  print_error "Firebase Config取得がキャンセルされました"
  exit 1
fi

if [ ! -f "firebase-config.json" ]; then
  print_error "firebase-config.json が見つかりません"
  exit 1
fi

FIREBASE_API_KEY=$(jq -r '.apiKey' firebase-config.json)
FIREBASE_AUTH_DOMAIN=$(jq -r '.authDomain' firebase-config.json)
FIREBASE_PROJECT_ID=$(jq -r '.projectId' firebase-config.json)
FIREBASE_STORAGE_BUCKET=$(jq -r '.storageBucket' firebase-config.json)
FIREBASE_MESSAGING_SENDER_ID=$(jq -r '.messagingSenderId' firebase-config.json)
FIREBASE_APP_ID=$(jq -r '.appId' firebase-config.json)
FIREBASE_MEASUREMENT_ID=$(jq -r '.measurementId // "not-set"' firebase-config.json)

print_success "Firebase Configを取得しました"

# =============================================================================
# ステップ11: apphosting.staging.yamlの生成
# =============================================================================
print_step "ステップ11: apphosting.staging.yamlの生成"

cat > apphosting.staging.yaml <<EOF
# apphosting.staging.yaml
# 生成日: $(date)
# プロジェクト: $PROJECT_ID
# リージョン: $REGION

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

print_success "apphosting.staging.yamlが生成されました"

# =============================================================================
# ステップ12: Firebase App Hostingのセットアップ
# =============================================================================
print_step "ステップ12: Firebase App Hostingのセットアップ"

print_warning "手動ステップが必要です！"
echo ""
echo "以下の手順を実行してください："
echo "1. https://console.firebase.google.com/project/$PROJECT_ID/apphosting にアクセス"
echo "2. '始める' をクリック"
echo "3. GitHubに接続してリポジトリを選択: $GITHUB_REPO_OWNER/$GITHUB_REPO_NAME"
echo "4. バックエンドを作成:"
echo "   - バックエンドID: $BACKEND_ID"
echo "   - ブランチ: $GIT_BRANCH"
echo "   - ルートディレクトリ: /"
echo "   - リージョン: $REGION"
echo ""
echo -e "${YELLOW}完了したら 'yes' と入力してください:${NC}"
read -r APPHOSTING_DONE

if [ "$APPHOSTING_DONE" != "yes" ]; then
  print_error "App Hosting設定がキャンセルされました"
  exit 1
fi

# Firebaseにログイン（まだの場合）
if ! firebase projects:list &> /dev/null; then
  print_info "Firebaseにログイン中..."
  firebase login
fi

# 環境名の設定
print_info "バックエンドの環境名を設定中..."
echo ""
echo -e "${YELLOW}次の手順を実行してください:${NC}"
echo "1. https://console.firebase.google.com/project/$PROJECT_ID/apphosting にアクセス"
echo "2. バックエンド '$BACKEND_ID' の [ダッシュボードを表示] をクリック"
echo "3. [設定] タブ → [環境] を選択"
echo "4. [環境名] に 'staging' と入力"
echo "5. [保存] をクリック"
echo ""
echo -e "${BLUE}これにより、App Hostingは apphosting.staging.yaml を使用します${NC}"
echo ""
echo -e "${YELLOW}完了したら 'yes' と入力してください:${NC}"
read -r ENV_NAME_DONE

if [ "$ENV_NAME_DONE" != "yes" ]; then
  print_warning "環境名の設定をスキップしました（後で設定してください）"
fi

# App Hostingバックエンドにシークレットアクセスを付与
print_info "App Hostingバックエンドにシークレットアクセスを付与中..."

SECRETS=(
  "firebase-admin-client-email"
  "firebase-admin-private-key"
  "db-password"
  "transaction-hub-api-key"
  "google-genkit-api-key"
  "api-register-password"
  "jwt-secret"
)

for SECRET in "${SECRETS[@]}"; do
  print_info "シークレット $SECRET にアクセス権限を付与中..."
  firebase apphosting:secrets:grantaccess "$SECRET" \
    --backend "$BACKEND_ID" \
    --project "$PROJECT_ID" || true
done

print_success "すべてのシークレットにアクセス権限が付与されました"

# =============================================================================
# セットアップ完了
# =============================================================================
print_step "🎉 セットアップ完了！"

echo ""
echo -e "${GREEN}=========================================="
echo "プロジェクト情報"
echo "==========================================${NC}"
echo "プロジェクトID: $PROJECT_ID"
echo "リージョン: $REGION"
echo "固定IP: $STATIC_IP"
echo "Cloud SQL: $CLOUD_SQL_CONNECTION_NAME"
echo ""

# APIキーがプレースホルダーの場合は警告を表示
if [[ "$GOOGLE_GENKIT_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]] || [[ "$TRANSACTION_HUB_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]]; then
  echo -e "${YELLOW}=========================================="
  echo "⚠️  APIキーの追加が必要です"
  echo "==========================================${NC}"
  echo ""
  echo "以下のAPIキーがプレースホルダーのままです："
  echo ""

  if [[ "$GOOGLE_GENKIT_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]]; then
    echo "  ❌ Google Genkit API Key"
    echo "     取得先: https://aistudio.google.com/app/apikey"
    echo ""
  fi

  if [[ "$TRANSACTION_HUB_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]]; then
    echo "  ❌ Transaction Hub API Key"
    echo "     取得先: Transaction Hub ダッシュボード"
    echo ""
  fi

  echo -e "${BLUE}APIキー取得後、以下のコマンドで更新してください:${NC}"
  echo ""

  if [[ "$GOOGLE_GENKIT_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]]; then
    echo "# Google Genkit API Keyを更新"
    echo "echo -n \"YOUR_GENKIT_API_KEY\" | gcloud secrets versions add google-genkit-api-key --data-file=- --project=$PROJECT_ID"
    echo ""
  fi

  if [[ "$TRANSACTION_HUB_API_KEY" == "PLACEHOLDER_REPLACE_LATER" ]]; then
    echo "# Transaction Hub API Keyを更新"
    echo "echo -n \"YOUR_TRANSACTION_HUB_KEY\" | gcloud secrets versions add transaction-hub-api-key --data-file=- --project=$PROJECT_ID"
    echo ""
  fi

  echo -e "${YELLOW}⚠️  これらのAPIキーがないと、AI機能と決済機能が動作しません${NC}"
  echo ""
fi
echo ""
echo -e "${YELLOW}=========================================="
echo "次のステップ"
echo "==========================================${NC}"
echo "1. apphosting.staging.yaml を GitHubリポジトリにコピー"
echo "2. $GIT_BRANCH ブランチにコミット＆プッシュ:"
echo ""
echo "   git checkout $GIT_BRANCH"
echo "   git add apphosting.staging.yaml"
echo "   git commit -m 'feat: add App Hosting configuration for staging'"
echo "   git push origin $GIT_BRANCH"
echo ""
echo "3. Firebase App Hostingが自動的にビルドとデプロイを開始します"
echo ""
echo -e "${BLUE}=========================================="
echo "便利なリンク"
echo "==========================================${NC}"
echo "Firebase Console:"
echo "  https://console.firebase.google.com/project/$PROJECT_ID"
echo ""
echo "App Hosting:"
echo "  https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo ""
echo "GCP Console:"
echo "  https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo ""
echo -e "${GREEN}=========================================="
echo "認証情報"
echo "==========================================${NC}"
echo "認証情報は以下に保存されています:"
echo "  $CREDENTIALS_FILE"
echo ""
echo -e "${RED}🔐 重要: このファイルを安全に保管してください！${NC}"
echo ""
echo -e "${GREEN}セットアップが完了しました！${NC}"
