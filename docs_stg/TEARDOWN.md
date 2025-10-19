# インフラストラクチャ削除ガイド

このガイドでは、継続的なコストを回避するために、Nukuneステージング環境を安全に削除する手順を説明します。

## ⚠️ 警告

**このプロセスは不可逆です。** リソースを削除すると、すべてのデータが永久に失われます。

**続行する前に:**

- [ ] 保持する必要のあるデータをエクスポート
- [ ] データベースのバックアップを作成
- [ ] Storageから重要なファイルをダウンロード
- [ ] 正しいプロジェクトを削除しようとしていることを確認
- [ ] チームに削除について通知

---

## 目次

1. [クイック削除（プロジェクト全体を削除）](#クイック削除プロジェクト全体を削除)
2. [選択的削除（プロジェクトを保持）](#選択的削除プロジェクトを保持)
3. [削除順序（手動）](#削除順序手動)
4. [自動削除スクリプト](#自動削除スクリプト)
5. [検証](#検証)
6. [削除後のコスト](#削除後のコスト)

---

## クイック削除（プロジェクト全体を削除）

**最速の方法**: GCPプロジェクト全体を削除します。これですべてが削除されます。

### コンソール経由

1. [GCP Console](https://console.cloud.google.com) にアクセス
2. プロジェクトを選択（例: `nukune-staging`）
3. IAMと管理 → 設定 に移動
4. 上部の「シャットダウン」をクリック
5. プロジェクトIDを入力して確認
6. 「シャットダウン」を再度クリック

**タイムライン:**
- 即座に削除がスケジュールされます
- 30日後に実際に削除されます（この期間は回復可能）
- 課金は即座に停止します

### CLI経由

```bash
# 削除するプロジェクトを設定
PROJECT_ID="your-project-id"

# 正しいプロジェクトであることを確認
gcloud config get-value project
echo "削除しようとしているプロジェクト: $PROJECT_ID"
echo "確認するには 'DELETE' と入力してください:"
read CONFIRM

if [ "$CONFIRM" = "DELETE" ]; then
  gcloud projects delete $PROJECT_ID
  echo "✅ プロジェクトの削除がスケジュールされました"
else
  echo "❌ 中止しました"
fi
```

---

## 選択的削除（プロジェクトを保持）

GCPプロジェクトは保持したいが、高額なリソースを削除したい場合:

### オプション1: 高額なサービスのみを停止

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"  # または us-central1

# Cloud SQLを停止（最大のコスト削減）
CLOUD_SQL_INSTANCE="nukune-mysql"
gcloud sql instances patch $CLOUD_SQL_INSTANCE \
  --activation-policy=NEVER \
  --project=$PROJECT_ID

# Cloud Runをゼロにスケール
gcloud run services update SERVICE_NAME \
  --min-instances=0 \
  --max-instances=0 \
  --region=$REGION \
  --project=$PROJECT_ID
```

**停止後の推定コスト:** 月額 $5〜10（ストレージのみ）

### オプション2: すべてのリソースを削除

[削除順序](#削除順序手動) または [自動スクリプト](#自動削除スクリプト) を参照してください。

---

## 削除順序（手動）

**依存関係エラーを回避するために、この順序でリソースを削除してください:**

### 1. 自動デプロイを停止

**誤ったデプロイを防ぐためにGitHubを切断:**

```bash
# Firebase Console経由
# 1. https://console.firebase.google.com/project/YOUR_PROJECT/apphosting にアクセス
# 2. バックエンドを選択
# 3. バックエンド設定 → リポジトリを切断 をクリック
```

### 2. Cloud Runサービスを削除

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"

# すべてのCloud Runサービスをリスト表示
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID

# 各サービスを削除
gcloud run services delete SERVICE_NAME \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet
```

### 3. Firebase App Hostingバックエンドを削除

```bash
BACKEND_ID="nukune-staging"

# Firebase Console経由:
# 1. https://console.firebase.google.com/project/YOUR_PROJECT/apphosting
# 2. バックエンドを選択 → 設定 → バックエンドを削除

# またはCLI経由（利用可能な場合）:
# firebase apphosting:backends:delete $BACKEND_ID --project=$PROJECT_ID
```

### 4. Cloud NATとネットワーキングを削除

```bash
NAT_GATEWAY_NAME="nukune-nat"
CLOUD_ROUTER_NAME="nukune-router"
NAT_IP_NAME="nukune-nat-ip"
VPC_CONNECTOR_NAME="nukune-connector"

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

# 静的IPを解放
gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

# VPCコネクタを削除
gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet
```

### 5. Cloud SQLインスタンスを削除

```bash
CLOUD_SQL_INSTANCE="nukune-mysql"

# 最終バックアップを作成（オプションですが推奨）
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --description="削除前の最終バックアップ" \
  --project=$PROJECT_ID

# Cloud SQLインスタンスを削除
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet
```

### 6. Secret Managerのシークレットを削除

```bash
# すべてのシークレットをリスト表示
gcloud secrets list --project=$PROJECT_ID

# すべてのシークレットを削除
for secret in firebase-admin-client-email firebase-admin-private-key db-password transaction-hub-api-key google-genkit-api-key api-register-password jwt-secret; do
  echo "シークレットを削除中: $secret"
  gcloud secrets delete $secret --project=$PROJECT_ID --quiet
done
```

### 7. Firebaseデータを削除

**Firestore:**

```bash
# Firebase Console経由:
# 1. https://console.firebase.google.com/project/YOUR_PROJECT/firestore にアクセス
# 2. コレクションを手動で削除（一括削除は利用不可）

# またはFirebase CLIとスクリプトを使用（自動セクション参照）
```

**Storage:**

```bash
# Firebase Console経由:
# 1. https://console.firebase.google.com/project/YOUR_PROJECT/storage にアクセス
# 2. すべてのファイル/フォルダを削除

# またはgsutil経由:
gsutil -m rm -r gs://YOUR_PROJECT.appspot.com/**
```

**Authentication:**

```bash
# Firebase Consoleですべてのユーザーを削除:
# https://console.firebase.google.com/project/YOUR_PROJECT/authentication/users

# 注意: コンソールには一括削除がないため、個別に削除する必要があります
# 多数のユーザーがいる場合は、Firebase Admin SDKスクリプトを使用
```

### 8. ビルド成果物を削除

```bash
# Cloud Buildの履歴と成果物を削除
gcloud builds list --project=$PROJECT_ID --limit=100 --format="value(id)" | \
  xargs -I {} gcloud builds cancel {} --project=$PROJECT_ID --quiet

# コンテナイメージを削除
gcloud container images list --project=$PROJECT_ID
# https://console.cloud.google.com/gcr から手動で削除
```

---

## 自動削除スクリプト

### 完全削除スクリプト

**これを `teardown.sh` として保存:**

```bash
#!/bin/bash
set -e

# ===========================================
# 設定
# ===========================================
PROJECT_ID="your-project-id"
REGION="asia-east1"
CLOUD_SQL_INSTANCE="nukune-mysql"
VPC_CONNECTOR_NAME="nukune-connector"
CLOUD_ROUTER_NAME="nukune-router"
NAT_GATEWAY_NAME="nukune-nat"
NAT_IP_NAME="nukune-nat-ip"
BACKEND_ID="nukune-staging"

# ===========================================
# 確認
# ===========================================
echo "=========================================="
echo "⚠️  警告: インフラストラクチャ削除"
echo "=========================================="
echo "プロジェクト: $PROJECT_ID"
echo "リージョン: $REGION"
echo ""
echo "これは以下を削除します:"
echo "  - すべてのCloud Runサービス"
echo "  - Cloud SQLインスタンス: $CLOUD_SQL_INSTANCE"
echo "  - すべてのVPCリソース"
echo "  - すべてのSecret Managerシークレット"
echo "  - 固定IP: $NAT_IP_NAME"
echo ""
echo "確認するには 'DELETE EVERYTHING' と入力してください:"
read CONFIRM

if [ "$CONFIRM" != "DELETE EVERYTHING" ]; then
  echo "❌ 中止しました"
  exit 1
fi

echo ""
echo "削除を開始します..."
echo ""

# ===========================================
# ステップ1: Cloud Runサービス
# ===========================================
echo "🗑️  ステップ1: Cloud Runサービスを削除中..."

gcloud run services list \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(metadata.name)" | \
while read service; do
  echo "  Cloud Runサービスを削除中: $service"
  gcloud run services delete $service \
    --platform=managed \
    --region=$REGION \
    --project=$PROJECT_ID \
    --quiet
done

echo "✅ Cloud Runサービスが削除されました"
echo ""

# ===========================================
# ステップ2: Cloud NAT
# ===========================================
echo "🗑️  ステップ2: Cloud NATを削除中..."

gcloud compute routers nats delete $NAT_GATEWAY_NAME \
  --router=$CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  NATが見つかりません、スキップします"

echo "✅ Cloud NATが削除されました"
echo ""

# ===========================================
# ステップ3: Cloud Router
# ===========================================
echo "🗑️  ステップ3: Cloud Routerを削除中..."

gcloud compute routers delete $CLOUD_ROUTER_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  Routerが見つかりません、スキップします"

echo "✅ Cloud Routerが削除されました"
echo ""

# ===========================================
# ステップ4: 静的IP
# ===========================================
echo "🗑️  ステップ4: 静的IPを解放中..."

gcloud compute addresses delete $NAT_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  IPが見つかりません、スキップします"

echo "✅ 静的IPが解放されました"
echo ""

# ===========================================
# ステップ5: VPCコネクタ
# ===========================================
echo "🗑️  ステップ5: VPCコネクタを削除中..."

gcloud compute networks vpc-access connectors delete $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  VPCコネクタが見つかりません、スキップします"

echo "✅ VPCコネクタが削除されました"
echo ""

# ===========================================
# ステップ6: Cloud SQL（バックアップ付き）
# ===========================================
echo "🗑️  ステップ6: Cloud SQLを削除中..."

echo "  最終バックアップを作成中..."
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --description="削除前の最終バックアップ $(date +%Y-%m-%d)" \
  --project=$PROJECT_ID 2>/dev/null || echo "  バックアップ失敗、続行します..."

echo "  Cloud SQLインスタンスを削除中..."
gcloud sql instances delete $CLOUD_SQL_INSTANCE \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "  SQLインスタンスが見つかりません、スキップします"

echo "✅ Cloud SQLが削除されました"
echo ""

# ===========================================
# ステップ7: Secret Manager
# ===========================================
echo "🗑️  ステップ7: Secret Managerシークレットを削除中..."

SECRETS="firebase-admin-client-email firebase-admin-private-key db-password transaction-hub-api-key google-genkit-api-key api-register-password jwt-secret"

for secret in $SECRETS; do
  echo "  シークレットを削除中: $secret"
  gcloud secrets delete $secret \
    --project=$PROJECT_ID \
    --quiet 2>/dev/null || echo "  シークレットが見つかりません、スキップします"
done

echo "✅ シークレットが削除されました"
echo ""

# ===========================================
# ステップ8: ストレージバケット（オプション）
# ===========================================
echo "🗑️  ステップ8: ストレージバケットをクリーンアップ中..."

# ストレージバケットをリスト表示
echo "  プロジェクト内のストレージバケット:"
gsutil ls -p $PROJECT_ID

echo ""
echo "  ⚠️  手動アクションが必要です:"
echo "  必要に応じてストレージバケットを手動で削除してください:"
echo "  https://console.cloud.google.com/storage/browser?project=$PROJECT_ID"
echo ""

# ===========================================
# 削除完了
# ===========================================
echo "=========================================="
echo "✅ 削除完了！"
echo "=========================================="
echo ""
echo "残りのクリーンアップ（手動）:"
echo "  1. Consoleでfirebase App Hostingバックエンドを削除"
echo "  2. ConsoleでFirestoreコレクションを削除"
echo "  3. ConsoleでStorageバケット/ファイルを削除"
echo "  4. ConsoleでAuthユーザーを削除"
echo "  5. （オプション）プロジェクト全体を削除"
echo ""
echo "Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
echo "GCP Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo ""
echo "プロジェクト全体を削除するには:"
echo "  gcloud projects delete $PROJECT_ID"
echo "=========================================="
```

### 実行可能にする

```bash
chmod +x teardown.sh
./teardown.sh
```

---

## 検証

### リソースが削除されたことを確認

```bash
PROJECT_ID="your-project-id"
REGION="asia-east1"

# Cloud Runを確認
gcloud run services list --platform=managed --region=$REGION --project=$PROJECT_ID
# 期待される結果: 空のリスト

# Cloud SQLを確認
gcloud sql instances list --project=$PROJECT_ID
# 期待される結果: 空のリスト

# VPCコネクタを確認
gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT_ID
# 期待される結果: 空のリスト

# 静的IPを確認
gcloud compute addresses list --project=$PROJECT_ID
# 期待される結果: 空のリスト

# シークレットを確認
gcloud secrets list --project=$PROJECT_ID
# 期待される結果: 空のリスト

# Cloud Routerを確認
gcloud compute routers list --project=$PROJECT_ID
# 期待される結果: 空のリスト
```

### 課金を確認

1. [課金コンソール](https://console.cloud.google.com/billing) にアクセス
2. 請求先アカウントを選択
3. プロジェクトの「レポート」を表示
4. 料金が$0（またはほぼ$0）に減少していることを確認

**注意:** 一部の料金は課金レポートに反映されるまで24〜48時間かかる場合があります。

---

## 削除後のコスト

### 完全削除（すべてのリソースを削除）

**推定コスト:** 月額 $0〜2

残りの料金:
- Cloud Buildの履歴ストレージ: 月額 〜$0.50
- Container Registryイメージ: 月額 〜$0.50
- Firestore/Storage（削除しなかった場合）: 変動

### 部分削除（プロジェクト保持、主要サービス停止）

**推定コスト:** 月額 $5〜10

残りの料金:
- ストレージ（Firestore、Cloud Storage、バックアップ）: 月額 $2〜5
- ネットワーキング（VPCが完全に削除されていない場合）: 月額 $1〜3
- 小規模なCloud SQLバックアップ: 月額 $1〜2
- ログ/モニタリングデータ: 月額 $1〜2

---

## 回復オプション

### 30日以内（プロジェクト削除）

```bash
# 削除されたプロジェクトをリスト表示
gcloud projects list --filter="lifecycleState:DELETE_REQUESTED"

# プロジェクトを復元
gcloud projects undelete PROJECT_ID
```

### リソース削除後

- **Cloud SQL:** 自動バックアップから復元（7〜365日の保持期間）
- **Firestore:** エクスポートから復元（事前に作成した場合）
- **Storage:** バージョニングが有効でない限り回復不可
- **シークレット:** 回復不可、再作成が必要

---

## 誤削除の防止

### 削除保護を設定

**Cloud SQL:**

```bash
gcloud sql instances patch INSTANCE_NAME \
  --deletion-protection \
  --project=$PROJECT_ID
```

**プロジェクトレベル:**

```bash
# プロジェクトの削除を防ぐためにlienを追加
gcloud resource-manager liens create \
  --restrictions=resourcemanager.projects.delete \
  --reason="誤削除を防止" \
  --project=$PROJECT_ID
```

### 予算アラート

コストが高額になる前に通知する課金アラートを設定:

1. [課金コンソール](https://console.cloud.google.com/billing) → 予算とアラート
2. $50、$100などで予算アラートを作成
3. メール通知を受信

---

## 関連ドキュメント

- [FROM_SCRATCH.md](./FROM_SCRATCH.md) - セットアップガイド（このドキュメントの逆）
- [FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md) - 自動セットアップスクリプト
- [README.md](./README.md) - ドキュメントインデックス

---

## クイックリファレンス

### サービスを停止（一時停止、削除しない）

```bash
# Cloud SQLを停止
gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER

# Cloud Runをゼロにスケール
gcloud run services update SERVICE_NAME --max-instances=0

# APIを無効化（それらのサービスの課金を停止）
gcloud services disable run.googleapis.com sqladmin.googleapis.com
```

### プロジェクト全体を削除

```bash
gcloud projects delete PROJECT_ID
```

### 実行中のものを確認（監査）

```bash
# すべてのCloud Runサービス
gcloud run services list --platform=managed

# すべてのCloud SQLインスタンス
gcloud sql instances list

# すべてのCompute Engineリソース
gcloud compute instances list
gcloud compute addresses list
gcloud compute disks list

# すべてのストレージバケット
gsutil ls

# すべてのシークレット
gcloud secrets list
```

---

**最終更新日:** 2025-10-20
