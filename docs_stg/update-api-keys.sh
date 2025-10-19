#!/bin/bash
# =============================================================================
# APIキー更新スクリプト
# =============================================================================
# このスクリプトは、セットアップ後にAPIキーを更新するために使用します。
#
# 使用方法:
#   chmod +x update-api-keys.sh
#   ./update-api-keys.sh
#
# または環境変数で指定:
#   PROJECT_ID="your-project" \
#   GOOGLE_GENKIT_API_KEY="AIza..." \
#   TRANSACTION_HUB_API_KEY="stg_..." \
#   ./update-api-keys.sh
# =============================================================================

set -e

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo -e "${BLUE}=========================================="
echo "APIキー更新スクリプト"
echo "==========================================${NC}"
echo ""

# プロジェクトIDの取得
if [ -z "$PROJECT_ID" ]; then
  # 現在のgcloudプロジェクトを使用
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

  if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}GCPプロジェクトIDを入力してください:${NC}"
    read -r PROJECT_ID
  else
    print_info "現在のプロジェクト: $PROJECT_ID"
    echo "このプロジェクトを使用しますか？ (yes/no)"
    read -r USE_CURRENT
    if [ "$USE_CURRENT" != "yes" ]; then
      echo "プロジェクトIDを入力してください:"
      read -r PROJECT_ID
    fi
  fi
fi

# プロジェクトを設定
gcloud config set project "$PROJECT_ID"

echo ""
echo -e "${BLUE}更新するAPIキーを選択してください:${NC}"
echo "1) Google Genkit API Key"
echo "2) Transaction Hub API Key"
echo "3) 両方"
echo ""
read -r CHOICE

UPDATE_GENKIT=false
UPDATE_TRANSACTION_HUB=false

case $CHOICE in
  1)
    UPDATE_GENKIT=true
    ;;
  2)
    UPDATE_TRANSACTION_HUB=true
    ;;
  3)
    UPDATE_GENKIT=true
    UPDATE_TRANSACTION_HUB=true
    ;;
  *)
    print_error "無効な選択です"
    exit 1
    ;;
esac

# Google Genkit API Keyの更新
if [ "$UPDATE_GENKIT" = true ]; then
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Google Genkit API Key の更新${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  print_info "取得先: https://aistudio.google.com/app/apikey"
  echo ""

  if [ -z "$GOOGLE_GENKIT_API_KEY" ]; then
    echo -e "${YELLOW}Google Genkit API Key を入力してください (形式: AIza...):${NC}"
    read -r GOOGLE_GENKIT_API_KEY
  fi

  if [ -z "$GOOGLE_GENKIT_API_KEY" ]; then
    print_warning "Google Genkit API Keyがスキップされました"
  else
    print_info "Secret Managerを更新中..."
    echo -n "$GOOGLE_GENKIT_API_KEY" | gcloud secrets versions add google-genkit-api-key \
      --data-file=- \
      --project="$PROJECT_ID"

    print_success "Google Genkit API Keyが更新されました"
  fi
fi

# Transaction Hub API Keyの更新
if [ "$UPDATE_TRANSACTION_HUB" = true ]; then
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Transaction Hub API Key の更新${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  print_info "取得先: Transaction Hub ダッシュボード"
  echo ""

  if [ -z "$TRANSACTION_HUB_API_KEY" ]; then
    echo -e "${YELLOW}Transaction Hub API Key を入力してください (形式: stg_...):${NC}"
    read -r TRANSACTION_HUB_API_KEY
  fi

  if [ -z "$TRANSACTION_HUB_API_KEY" ]; then
    print_warning "Transaction Hub API Keyがスキップされました"
  else
    print_info "Secret Managerを更新中..."
    echo -n "$TRANSACTION_HUB_API_KEY" | gcloud secrets versions add transaction-hub-api-key \
      --data-file=- \
      --project="$PROJECT_ID"

    print_success "Transaction Hub API Keyが更新されました"
  fi
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ 更新完了"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}次のステップ:${NC}"
echo "1. Firebase App Hostingで新しいビルドをトリガー"
echo "   → https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo ""
echo "2. または、GitHubにプッシュして自動ビルド"
echo "   → git push origin staging"
echo ""
print_info "更新されたAPIキーは次回のデプロイから有効になります"
echo ""
