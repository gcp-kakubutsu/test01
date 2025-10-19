# ステージング環境セットアップドキュメント

このディレクトリには、Nukuneアプリケーションのステージング環境をFirebase App Hostingにゼロから構築するためのドキュメントが含まれています。

## 🚀 クイックスタート

**このプロジェクトは初めてですか？** ここから始めてください：

### 🎯 推奨フロー

1. **[PREREQUISITES.md](./PREREQUISITES.md)** - 必要なツールとAPIキー情報を確認
2. **`./setup.sh`** を実行 - 対話式で質問に答えるだけ
3. APIキーは後から **`./update-api-keys.sh`** で追加可能

**💡 ポイント:** APIキーがなくても構築開始できます！

### 📚 その他のドキュメント

- **[SETUP_SCRIPT_USAGE.md](./SETUP_SCRIPT_USAGE.md)** - setup.shの詳細な使い方
- **[FROM_SCRATCH.md](./FROM_SCRATCH.md)** - 手動セットアップガイド（理解を深めたい場合）
- **[FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md)** - CLIコマンドリファレンス

**推定時間:** 2-3時間
**推定コスト:** $40-60/月（ステージング環境向けに最適化）

---

## 📚 ドキュメント索引

### コアドキュメント（ここから始める）

| ドキュメント | 目的 | 使用するとき |
|----------|---------|-------------|
| **[PREREQUISITES.md](./PREREQUISITES.md)** | 事前準備チェックリスト（APIキー取得方法など） | セットアップを始める前に必ず読む |
| **[setup.sh](./setup.sh)** + **[使い方](./SETUP_SCRIPT_USAGE.md)** | ワンコマンド自動セットアップスクリプト | 最速でセットアップしたい場合（推奨） |
| **[FROM_SCRATCH.md](./FROM_SCRATCH.md)** | 新規GCPプロジェクトから始める手動セットアップガイド | 手動で一つ一つ確認しながら構築したい場合 |
| **[FROM_SCRATCH_CLI.md](./FROM_SCRATCH_CLI.md)** | CLIコマンドリファレンス | コマンドを個別に実行したい場合 |

### 補足ドキュメント

| ドキュメント | 目的 | 使用するとき |
|----------|---------|-------------|
| [SECRET_MANAGER_SETUP.md](./SECRET_MANAGER_SETUP.md) | Secret Managerの詳細な設定手順 | シークレットの問題をトラブルシューティングする場合 |
| [INFRASTRUCTURE_OVERVIEW.md](./INFRASTRUCTURE_OVERVIEW.md) | アーキテクチャとインフラストラクチャの詳細 | システムアーキテクチャを理解する場合 |
| [BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md) | よくあるビルドエラーと解決方法 | ビルドが失敗した場合 |
| [TEARDOWN.md](./TEARDOWN.md) | インフラストラクチャの削除とクリーンアップ | コストを停止するためにリソースを削除する場合 |

### レガシードキュメント（参照のみ）

**すべてのレガシードキュメントは `obsolete/` ディレクトリに移動されました。**

| ドキュメント | ステータス | 備考 |
|----------|--------|-------|
| [obsolete/STG_ORDER.md](./obsolete/STG_ORDER.md) | ⚠️ レガシー | 元の要件ドキュメント |
| [obsolete/STAGING_PREREQUISITES.md](./obsolete/STAGING_PREREQUISITES.md) | ⚠️ 廃止 | FROM_SCRATCH.mdに置き換えられました |
| [obsolete/STAGING_SETUP.md](./obsolete/STAGING_SETUP.md) | ⚠️ 廃止 | FROM_SCRATCH.mdに置き換えられました |
| [obsolete/MYSQL_TESTING_WITHOUT_DATA.md](./obsolete/MYSQL_TESTING_WITHOUT_DATA.md) | ⚠️ 廃止 | テストガイダンスはメインドキュメントに統合されました |

**注意:** レガシードキュメントには古い情報（例：Firebase App Hostingでサポートされていない `asia-northeast1` への参照）が含まれています。新しいドキュメントを使用してください。

---

## 🌍 サポートされているリージョン

Firebase App Hostingは以下のリージョンをサポートしています（2025年10月時点）：

### このプロジェクトの推奨リージョン

| リージョン | ロケーション | 最適な用途 | 日本へのレイテンシ |
|--------|----------|----------|------------------|
| **asia-east1** ⭐ | 台湾 | アジア/日本のユーザー | ~50ms |
| us-central1 | アイオワ、米国 | 米国のユーザー | ~150ms |
| asia-southeast1 | シンガポール | 東南アジア | ~70ms |
| europe-west4 | オランダ | ヨーロッパ | ~200ms |

**重要:**
- ❌ `asia-northeast1`（東京）はFirebase App Hostingで**サポートされていません**
- ✅ すべてのリソースは**同じリージョン**に配置する必要があります（Cloud Run、Cloud SQL、VPC）
- ✅ アジアで最高のパフォーマンスを得るには**`asia-east1`を使用**してください

---

## 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│ GitHubリポジトリ（stagingブランチ）                    │
└────────────────┬────────────────────────────────────┘
                 │ git push
                 ↓
┌─────────────────────────────────────────────────────┐
│ Firebase App Hosting（ビルド）                        │
│  - Buildpacksが自動でNext.jsを検出                    │
│  - Secret Managerとの統合                            │
└────────────────┬────────────────────────────────────┘
                 │ デプロイ
                 ↓
┌─────────────────────────────────────────────────────┐
│ Cloud Run（asia-east1またはus-central1）             │
│  - Next.js 15アプリ                                  │
│  - オートスケーリング（ステージング環境ではminInstances=0）│
└────┬──────────────────┬─────────────────────────────┘
     │                  │
     │                  ↓
     │            ┌──────────────────────────┐
     │            │ Cloud SQL MySQL           │
     │            │  - ユーザーデータストレージ │
     │            │  - 同じリージョン           │
     │            └──────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│ VPCネットワーク + Cloud NAT                           │
│  - 固定アウトバウンドIPアドレス                         │
│  - プライベートCloud SQL接続                           │
└─────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│ Firebaseサービス                                     │
│  - Authentication（メール/パスワード）                 │
│  - Firestore（ユーザープロフィール、メッセージ）        │
│  - Storage（画像）                                   │
└─────────────────────────────────────────────────────┘
```

---

## 📋 セットアップチェックリスト

進捗を追跡するためにこのチェックリストを使用してください：

### 前提条件
- [ ] 請求が有効なGoogleアカウント
- [ ] GitHubリポジトリへのアクセス
- [ ] Firebase CLIのインストール（`npm install -g firebase-tools`）
- [ ] gcloud CLIのインストール
- [ ] APIキーの取得（Genkit、Transaction Hub）

### インフラストラクチャのセットアップ
- [ ] GCPプロジェクトの作成
- [ ] Firebaseプロジェクトの初期化
- [ ] Cloud SQLインスタンスの起動
- [ ] データベースとユーザーの作成
- [ ] VPC Connectorの設定
- [ ] 静的IPの予約
- [ ] Cloud NATの設定

### Secret Manager
- [ ] Firebase Admin認証情報の作成
- [ ] Secret Managerに7つのシークレットを作成
- [ ] サービスアカウントにアクセス権限を付与
- [ ] シークレットのテストと検証

### App Hosting
- [ ] GitHubリポジトリの接続
- [ ] バックエンドの作成と設定
- [ ] `apphosting.staging.yaml`の作成
- [ ] バックエンドへのシークレット権限付与
- [ ] 初期ビルドの成功
- [ ] アプリのデプロイとアクセス可能性の確認

### 検証
- [ ] 固定IPの確認
- [ ] データベース接続の動作確認
- [ ] Firebase Authの動作確認
- [ ] Git自動デプロイの動作確認

---

## 🛠️ よくある操作

### ログの表示

```bash
# Cloud Runのログ
gcloud run services logs read --platform=managed --region=asia-east1 --limit=50

# ビルドログ
gcloud builds list --limit=10

# 特定のビルド
gcloud builds log BUILD_ID
```

### シークレットの管理

```bash
# すべてのシークレットをリスト表示
gcloud secrets list

# シークレットの更新
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# シークレットの表示（デバッグ目的のみ！）
gcloud secrets versions access latest --secret=SECRET_NAME
```

### データベース操作

```bash
# Cloud SQLに接続
gcloud sql connect INSTANCE_NAME --user=root

# バックアップの作成
gcloud sql backups create --instance=INSTANCE_NAME
```

### GCPアカウントの切り替え

```bash
# アカウントのリスト表示
gcloud auth list

# アカウントの切り替え
gcloud auth login --account=EMAIL@gmail.com

# アクティブなプロジェクトの設定
gcloud config set project PROJECT_ID
```

---

## 💰 コスト最適化

### ステージング環境向け

```yaml
# apphosting.staging.yamlに記述
runConfig:
  minInstances: 0      # アイドル時にゼロにスケール
  maxInstances: 5      # スケーリングを制限
  cpu: 1               # 低いCPU
  memoryMiB: 2048      # 低いメモリ
```

**追加のヒント:**
- より小さいCloud SQLインスタンスを使用（`db-f1-micro`または`db-g1-small`）
- オフ時間中のCloud SQLのシャットダウンをスケジュール
- 自動バックアップを無効化（手動バックアップを使用）
- GCPコンソール → 請求で使用状況を監視

**最適化後の月額推定コスト:** $20-40

---

## 🐛 トラブルシューティング

### シークレットで「Permission Denied」エラーが発生してビルドが失敗する

**解決方法:** Cloud BuildサービスアカウントにSecret Managerアクセス権限を付与

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None
```

詳細な解決方法については[BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md)を参照してください。

### リージョンの不一致でCloud Runが失敗する

**エラー:** "The target region X must be the same as the region Y where the subnetwork resides"

**解決方法:** すべてのリソースが**同じリージョン**にあることを確認：
- `apphosting.staging.yaml`のVPCサブネットリージョンを確認
- App Hostingデプロイメントのリージョンと一致することを確認
- 必要に応じてサブネットリージョンを更新

### データベース接続が失敗する

**確認事項:**
1. Cloud SQLインスタンスが起動しているか: `gcloud sql instances list`
2. `apphosting.staging.yaml`の接続名が正しいか
3. データベースユーザーとパスワードが正しいか
4. App HostingでCloud SQL接続が設定されているか

---

## 🔗 便利なリンク

- [Firebase App Hostingドキュメント](https://firebase.google.com/docs/app-hosting)
- [Cloud Run VPCアクセス](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Cloud NATドキュメント](https://cloud.google.com/nat/docs)
- [Secret Managerドキュメント](https://cloud.google.com/secret-manager/docs)
- [Cloud SQL接続ガイド](https://cloud.google.com/sql/docs/mysql/connect-run)

---

## 📞 サポート

問題が発生した場合：

1. 関連ドキュメントのトラブルシューティングセクションを確認
2. Cloud Consoleでエラーメッセージを確認
3. よくあるエラーについては[BUILD_ERROR_FIX.md](./BUILD_ERROR_FIX.md)を確認
4. Firebase App Hostingドキュメントを参照

---

## 📝 変更履歴

### 2025-10-20
- ✨ FROM_SCRATCH.md追加 - 新規GCPプロジェクトからの完全セットアップガイド
- ✨ FROM_SCRATCH_CLI.md追加 - 自動セットアップスクリプト
- ✨ TEARDOWN.md追加 - インフラストラクチャ削除とクリーンアップガイド
- ⚠️ 古いドキュメントを廃止（STAGING_SETUP.md、STAGING_PREREQUISITES.md）
- ✅ リージョンガイダンスを更新（asia-northeast1を削除、asia-east1/us-central1を追加）
- 🔧 アカウント切り替えガイドを追加
- 📚 ドキュメント構造を再編成
- 📁 廃止されたドキュメントをobsolete/ディレクトリに移動

### 2025-10-18
- 初期ステージングドキュメント作成
- レガシードキュメント: STG_ORDER.md、STAGING_SETUP.mdなど

---

**始める準備はできましたか？** → [FROM_SCRATCH.md](./FROM_SCRATCH.md) 🚀
