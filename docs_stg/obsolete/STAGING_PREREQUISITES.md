# ステージング環境構築の前提条件チェックリスト

このドキュメントは、**リポジトリと空のGCPアカウントのみ**を持っている状態から、ステージング環境を構築するために必要なすべてのものをリストアップしています。

## 📌 作業範囲

**重要**: このステージング環境構築は**ネットワーク的にクローン**することが目的です。

- ✅ インフラ構成の複製（Firebase、Cloud SQL、VPC、固定IP）
- ✅ Git連携の設定
- ❌ アプリケーション動作の詳細検証は不要

---

## ✅ 必要なもの（Prerequisites）

### 1. アカウント・アクセス権限

#### Google Cloud Platform (GCP)
- [ ] GCPアカウント（既存 ✓）
- [ ] GCPプロジェクト `nukune-stg` 作成済み（既存 ✓）
- [ ] GCPコンソールへの**オーナー**または**編集者**権限
- [ ] 課金アカウントが設定済み（重要！）

**確認方法**:
```
1. https://console.cloud.google.com にアクセス
2. プロジェクト選択で "nukune-stg" が表示されるか確認
3. 左メニュー > お支払い > 課金アカウントがリンクされているか確認
```

#### Firebase
- [ ] Firebaseアカウント（GCPアカウントと同じGoogleアカウントでOK）
- [ ] Firebase Consoleへのアクセス権限

**確認方法**:
```
https://console.firebase.google.com にアクセスできるか確認
```

#### GitHub
- [ ] GitHubアカウント
- [ ] `Nukune` リポジトリへの**Admin**または**Write**権限
- [ ] リポジトリの `staging` ブランチが存在

**確認方法**:
```bash
git branch -a | grep staging
# または
https://github.com/your-org/Nukune/tree/staging にアクセス
```

---

### 2. 必要なAPI・サービスの有効化

以下のGoogle Cloud APIを有効化する必要があります（GCPコンソールで）:

- [ ] **Firebase Management API**
- [ ] **Cloud SQL Admin API**
- [ ] **Cloud Run API**
- [ ] **Compute Engine API**
- [ ] **Cloud Build API**
- [ ] **Container Registry API**
- [ ] **Artifact Registry API**
- [ ] **Cloud Logging API**
- [ ] **Cloud Monitoring API**
- [ ] **Serverless VPC Access API**

**一括有効化コマンド** (Cloud Shellで実行):
```bash
gcloud services enable \
  firebase.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  vpcaccess.googleapis.com \
  --project=nukune-stg
```

---

### 3. 外部サービスのアカウント・APIキー

#### 必須

- [ ] **Google Genkit API Key**
  - 用途: AI機能（プロフィール検証など）
  - 取得方法: [Google AI Studio](https://aistudio.google.com/app/apikey)

#### オプション（本番データがある場合のみ）

- [ ] **本番環境のMySQLデータへのアクセス**
  - データをコピーする場合のみ必要
  - 本番環境の管理者に確認

---

### 4. ローカル開発環境（オプション - 動作確認用）

- [ ] Node.js 18.x 以上
- [ ] npm または yarn
- [ ] Git

**確認方法**:
```bash
node --version  # v18.x.x 以上
npm --version   # 9.x.x 以上
git --version   # 2.x.x 以上
```

---

### 5. 環境変数の準備

以下の情報を事前に準備・決定しておく必要があります:

#### Firebase関連（手順1で取得）
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

#### Firebase Admin SDK（手順1で取得）
```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

#### MySQL関連（手順2で設定）
```
DB_HOST=（Cloud SQL接続文字列 - 手順2で決定）
DB_USER=nukune_app
DB_PASSWORD=（強力なパスワードを新規作成）
DB_NAME=nukune_stg
DB_PORT=3306
```

#### セキュリティ関連（新規作成）
```
API_REGISTER_PASSWORD=（管理者ページ用パスワード - 新規作成）
JWT_SECRET=（ランダムな長い文字列 - 新規作成）
ADMIN_EMAILS=admin@example.com（管理者メールアドレス）
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com（同上）
```

#### 外部API
```
GOOGLE_GENKIT_API_KEY=（上記で取得）
NEXT_PUBLIC_RESERVATION_SITE_URL=https://stg.nukipedia.jp（既存）
TRANSACTION_HUB_API_KEY=stg_xxxxxx（既存 - あれば）
NEXT_PUBLIC_TRANSACTION_HUB_API_KEY=stg_xxxxxx（既存 - あれば）
```

#### その他
```
NODE_ENV=staging
```

---

### 6. パスワード・シークレットの生成

以下のパスワード/シークレットを**事前に生成**しておくと作業がスムーズです:

#### MySQL Root パスワード
```bash
# 強力なランダムパスワード生成（32文字）
openssl rand -base64 32
```
**メモ**: `_____________________________`

#### MySQL App ユーザーパスワード
```bash
openssl rand -base64 32
```
**メモ**: `_____________________________`

#### API_REGISTER_PASSWORD（管理者ページ用）
```bash
openssl rand -base64 24
```
**メモ**: `_____________________________`

#### JWT_SECRET
```bash
openssl rand -base64 64
```
**メモ**: `_____________________________`

---

## 📋 必要なリソース（作成するもの）

### GCP/Firebaseリソース

ステージング環境で作成するリソース一覧:

#### Firebase
- [ ] Firebase プロジェクト（`nukune-stg` にFirebaseを追加）
- [ ] Firebase Authentication（メール/パスワード認証）
- [ ] Cloud Firestore Database
- [ ] Firebase Storage

#### Cloud SQL
- [ ] Cloud SQLインスタンス: `nukune-stg-mysql`
- [ ] データベース: `nukune_stg`
- [ ] ユーザー: `nukune_app`

#### ネットワーキング
- [ ] VPC Connector: `nukune-stg-connector`
- [ ] Cloud Router: `nukune-stg-router`
- [ ] 静的IPアドレス: `nukune-stg-nat-ip`
- [ ] Cloud NAT: `nukune-stg-nat`

#### Cloud Run / App Hosting
- [ ] Firebase App Hosting バックエンド: `nukune-staging`
- [ ] GitHub連携（`staging`ブランチ）

---

## 💰 予想コスト

### 初期費用
- **無料**: ほとんどのリソース作成自体は無料

### 月額ランニングコスト（推定）
- **Cloud Run**: $10-20（minInstances=0の場合）
- **Cloud SQL**: $30-50（小型インスタンス + 夜間停止）
- **Firestore**: $5-10（低トラフィック想定）
- **Storage**: $2-5
- **Cloud NAT**: $32-40
- **VPC Connector**: $15

**合計: 約 $94-140/月**

### コスト削減のヒント
1. Cloud SQL を夜間・休日に停止
2. Cloud Run の `minInstances` を 0 に設定
3. 不要な時はプロジェクト全体を一時停止

---

## 🕐 所要時間の目安

各手順の所要時間:

| 手順 | 内容 | 所要時間 |
|------|------|----------|
| 1 | Firebase セットアップ | 15-20分 |
| 2 | Cloud SQL セットアップ | 10-15分（起動待ち含む） |
| 3 | VPC/固定IP セットアップ | 20-30分 |
| 4 | Firebase App Hosting セットアップ | 15-20分 |
| 5 | Cloud SQL 接続設定 | 5-10分 |
| 6 | Git連携確認 | 5分 |
| 7 | 固定IP確認 | 5分 |
| 8 | セキュリティ設定確認 | 10分 |

**合計: 約 1.5〜2.5時間**
（初めての場合は +30分〜1時間）

---

## 📝 事前準備チェックリスト

構築作業を開始する前に、以下を確認してください:

### アカウント・権限
- [ ] GCPアカウントでログイン済み
- [ ] GCPプロジェクト `nukune-stg` が存在
- [ ] 課金アカウントがリンク済み
- [ ] GitHubアカウントでログイン済み
- [ ] リポジトリへのアクセス権限あり

### ツール・ブラウザ
- [ ] Chrome または Firefox（最新版）
- [ ] タブを複数開ける状態（GCP Console, Firebase Console, GitHub）
- [ ] パスワードマネージャー（生成したパスワードを保存）

### 情報の準備
- [ ] 必要なパスワードを生成済み（上記参照）
- [ ] Google Genkit API Key取得済み
- [ ] 管理者メールアドレス決定済み
- [ ] `.env.example` の内容を確認済み

### ドキュメント
- [ ] `docs/STAGING_SETUP.md` を開いて準備
- [ ] `docs/INFRASTRUCTURE_OVERVIEW.md` を読んで全体像を理解
- [ ] このチェックリストを印刷またはサブディスプレイで表示

---

## 🚀 次のステップ

すべてのチェックが完了したら、`docs/STAGING_SETUP.md` の手順に従って構築を開始してください。

```bash
# 手順書を開く
cat docs/STAGING_SETUP.md

# または
open docs/STAGING_SETUP.md  # macOS
xdg-open docs/STAGING_SETUP.md  # Linux
```

---

## ❓ よくある質問

### Q1: GCPの課金を有効化する必要がありますか？

**A**: はい、必須です。無料トライアルクレジットがある場合はそれを使用できますが、課金アカウントをリンクする必要があります。

- 新規GCPアカウント: $300の無料クレジットあり（90日間）
- これで十分ステージング環境の構築・テストが可能

### Q2: 本番環境のデータは必要ですか？

**A**: 必須ではありません。

- **データなし**: 空のデータベースから開始（推奨）
- **データあり**: 本番からコピー（個人情報のマスキング必要）

### Q3: ローカル環境でテストできますか？

**A**: はい、できます。

```bash
cd /home/ktaka/GitHub/Customer/Nukune
npm install
npm run dev
```

ただし、ステージング環境の構築にローカル環境は必須ではありません。

### Q4: 固定IPは本当に必要ですか？

**A**: 以下の場合は必要です:

- 決済サービス（Telecom Credit等）を使用する場合
- 外部APIがIPアドレス制限をしている場合

テストのみの場合は固定IPなしでも動作します（手順3をスキップ可能）。

### Q5: Firebase App Hosting と Cloud Run の違いは？

**A**:
- **Firebase App Hosting**: Firebase提供のラッパーサービス（簡単）
- **Cloud Run**: 実際に動作する基盤

Firebase App Hostingを使うことで、Cloud Runの複雑な設定を自動化できます。

### Q6: GitHub連携で失敗したら？

**A**: 以下を確認:
1. リポジトリの権限（Admin以上が必要）
2. Firebaseアプリの認証（GitHubアカウントで）
3. `staging` ブランチの存在

### Q7: ビルドエラーが出たら？

**A**:
1. Firebase Console > App Hosting > ビルドログを確認
2. 環境変数が正しく設定されているか確認
3. ローカルで `npm run build` をテスト

---

## 📞 サポート

問題が発生した場合:

1. **エラーメッセージをコピー**
2. **どの手順で発生したか記録**
3. **スクリーンショットを撮影**
4. チームに共有 or Claude Codeに質問

---

## 📚 参考リンク

- [GCP Console](https://console.cloud.google.com)
- [Firebase Console](https://console.firebase.google.com)
- [Google AI Studio (Genkit API Key取得)](https://aistudio.google.com/app/apikey)
- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [Cloud SQL ドキュメント](https://cloud.google.com/sql/docs)

---

これで準備完了です！頑張ってください 🚀
