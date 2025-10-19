# ステージング環境構築手順書

このドキュメントは、GCP上に構築した本番環境のクローンとして、ステージング環境を構築する手順を記載しています。

## 📋 作業方針

**重要**: このステージング環境構築は**ネットワーク的にクローンを作成**することが目的です。

- ✅ **実施する**: インフラ構成の複製（Firebase、Cloud SQL、VPC、固定IP、Git連携）
- ❌ **実施しない**: アプリケーションレベルの動作テスト、詳細な機能検証

つまり、**環境が正しく構築されていればOK**で、実際のアプリケーションが完全に動作するかの検証は不要です。

---

## 概要

- **本番プロジェクト**: `nukune` (既存)
- **ステージングプロジェクト**: `nukune-stg` (既存・作成済み)
- **Firebaseプロジェクト**: `nukune-stg01-475508` (既存・作成済み)
- **対象ブランチ**: `staging`
- **作業内容**:
  1. ✅ 現在の本番環境のネットワーク構成をクローン
  2. ✅ ステージング環境のグローバルIP固定化
  3. ✅ ステージング環境とGit (`staging`ブランチ) の連携

---

## 前提条件

### 既に作成済み
- ✅ GCPプロジェクト `nukune-stg`
- ✅ Firebaseプロジェクト `nukune-stg01-475508`

### 必要なアクセス権限
- GitHubリポジトリへのアクセス権限
- GCP コンソールへの管理者権限
- Firebase コンソールへのアクセス権限
- 課金アカウントがGCPプロジェクトにリンク済み

---

## 手順1: Firebaseプロジェクトのセットアップ

### 1.1 Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com) にアクセス
2. 「プロジェクトを追加」をクリック
3. 既存のGCPプロジェクト `nukune-stg` を選択
4. Firebase を有効化

### 1.2 必要なFirebaseサービスの有効化

#### Firebase Authentication
1. Firebase Console > Authentication
2. 「始める」をクリック
3. ログイン方法タブで「メール/パスワード」を有効化

#### Firestore Database
1. Firebase Console > Firestore Database
2. 「データベースを作成」をクリック
3. **本番モード**で開始（セキュリティルールは後で設定）
4. ロケーション: `asia-northeast1` (東京) を選択

#### Firebase Storage
1. Firebase Console > Storage
2. 「始める」をクリック
3. デフォルト設定で作成

### 1.3 Firebaseセキュリティルールの設定

#### Firestore Rules
Firebase Console > Firestore Database > ルール にて以下を設定:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection rules
    match /users/{userId} {
      // 認証されたユーザーは全てのユーザープロフィールを読める（マッチング用）
      allow read: if request.auth != null;

      // ユーザーは自分のデータのみ書き込める
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Messages collection rules
    match /messages/{messageId} {
      // 会話の参加者のみ読み書き可能
      allow read, write: if request.auth != null &&
        (request.auth.uid in resource.data.participants ||
         request.auth.uid in request.resource.data.participants);
    }

    // Matches collection rules
    match /matches/{matchId} {
      // マッチに関わるユーザーのみ読み書き可能
      allow read, write: if request.auth != null &&
        (request.auth.uid in resource.data.users ||
         request.auth.uid in request.resource.data.users);
    }
  }
}
```

#### Storage Rules
Firebase Console > Storage > ルール にて以下を設定:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 1.4 Firebase設定情報の取得

1. Firebase Console > プロジェクトの設定 > 全般
2. 「マイアプリ」セクションで ウェブアプリを追加 (`</>` アイコン)
3. アプリのニックネーム: `Nukune Staging`
4. Firebase Hosting は**チェックしない**
5. 表示された `firebaseConfig` をメモ（後で環境変数として使用）

---

## 手順2: MySQLデータベースのセットアップ

### 2.1 Cloud SQL インスタンスの作成

1. GCP Console > SQL を開く
2. 「インスタンスを作成」をクリック
3. MySQL を選択
4. 以下の設定を入力:
   - **インスタンスID**: `nukune-stg-mysql`
   - **パスワード**: 強力なパスワードを設定
   - **データベースバージョン**: MySQL 8.0
   - **リージョン**: `asia-northeast1` (東京)
   - **ゾーン**: 任意の可用性
   - **マシンタイプ**: 本番環境と同じ構成（または `db-n1-standard-2`）
   - **ストレージ**: SSD、10GB以上（自動増加を有効化）

5. 「作成」をクリック

### 2.2 データベースとユーザーの作成

1. 作成したインスタンスを選択
2. 「データベース」タブ > 「データベースを作成」
   - データベース名: `nukune_stg`
3. 「ユーザー」タブ > 「ユーザーアカウントを追加」
   - ユーザー名: `nukune_app`
   - パスワード: 強力なパスワードを設定
   - ホスト名: `%` (すべてのホストから接続可能)

### 2.3 データのセットアップ（簡易テスト用）

**重要**: ネットワーク構成の確認が目的のため、**本番データのコピーは不要**です。

接続確認のみ行う場合:

```sql
-- Cloud SQLに接続後、以下を実行
USE nukune_stg;

-- 接続テスト用のシンプルなテーブル作成
CREATE TABLE IF NOT EXISTS test_connection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_value VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- テストデータ挿入
INSERT INTO test_connection (test_value) VALUES ('Connection OK');

-- 確認
SELECT * FROM test_connection;
```

これで、Cloud SQLが正常に動作していることを確認できます。

**詳細なテスト方法**: 必要に応じて `docs_stg/MYSQL_TESTING_WITHOUT_DATA.md` を参照してください。

---

## 手順3: VPCネットワークとIP固定化の設定

### 3.1 VPC Connectorの作成

1. GCP Console > VPC ネットワーク > サーバーレス VPC アクセス
2. 「コネクタを作成」をクリック
3. 以下を設定:
   - **名前**: `nukune-stg-connector`
   - **リージョン**: `asia-northeast1`
   - **ネットワーク**: `default`
   - **サブネット**: カスタムIP範囲を作成 (例: `10.8.0.0/28`)
   - **最小インスタンス**: 2
   - **最大インスタンス**: 10
4. 「作成」をクリック

### 3.2 Cloud Routerの作成

1. GCP Console > ハイブリッド接続 > Cloud Router
2. 「ルーターを作成」をクリック
3. 以下を設定:
   - **名前**: `nukune-stg-router`
   - **ネットワーク**: `default`
   - **リージョン**: `asia-northeast1`
   - **Google ASN**: デフォルト値を使用
4. 「作成」をクリック

### 3.3 静的IPアドレスの予約

1. GCP Console > VPC ネットワーク > 外部 IP アドレス
2. 「静的アドレスを予約」をクリック
3. 以下を設定:
   - **名前**: `nukune-stg-nat-ip`
   - **IP バージョン**: IPv4
   - **タイプ**: リージョン
   - **リージョン**: `asia-northeast1`
4. 「予約」をクリック
5. **予約されたIPアドレスをメモ**

### 3.4 Cloud NATの作成

1. GCP Console > ネットワークサービス > Cloud NAT
2. 「NATゲートウェイを作成」をクリック
3. 以下を設定:
   - **ゲートウェイ名**: `nukune-stg-nat`
   - **VPC ネットワーク**: `default`
   - **リージョン**: `asia-northeast1`
   - **Cloud Router**: `nukune-stg-router` (先ほど作成したもの)
   - **NAT IP アドレス**: 「手動」を選択
   - **Cloud NAT IP アドレス**: `nukune-stg-nat-ip` を選択
4. 「作成」をクリック

これで、Cloud Run からの送信トラフィックが固定IPアドレスを使用するようになります。

---

## 手順4: Firebase App Hostingのセットアップ

### 4.1 Firebase App Hostingの有効化

1. Firebase Console > App Hosting (ビルド > App Hosting)
2. 「始める」をクリック

### 4.2 GitHubリポジトリの接続

1. 「GitHub リポジトリを接続」をクリック
2. GitHubアカウントで認証
3. リポジトリを選択: `your-org/Nukune` (実際のリポジトリ名)
4. アクセスを許可

### 4.3 バックエンドの作成

1. 「バックエンドを作成」をクリック
2. 以下を設定:
   - **バックエンド名**: `nukune-staging`
   - **ブランチ**: `staging`
   - **ルートディレクトリ**: `/` (リポジトリルート)
   - **ビルド設定**: 自動検出される（Next.js）
3. 「次へ」をクリック

### 4.4 環境変数の設定

**重要**: Firebase App Hostingでは環境変数UIが利用できません。

環境変数は**Secret Manager + apphosting.staging.yaml**で設定します。

詳細な手順は `SECRET_MANAGER_SETUP.md` を参照してください：
1. Google Cloud Secret Managerにシークレットを作成
2. リポジトリに `apphosting.staging.yaml` を作成
3. `staging`ブランチにプッシュ

**設定が必要な環境変数**:
- Firebase Client SDK（公開情報）
- Firebase Admin SDK（シークレット）
- MySQL接続情報（シークレット）
- Transaction Hub APIキー（シークレット）
- その他（Genkit、セキュリティ設定等）

### 4.5 apphosting.staging.yamlの作成

リポジトリのルートに `apphosting.staging.yaml` を作成します。

**詳細な内容とテンプレートは `SECRET_MANAGER_SETUP.md` を参照してください。**

基本構成例:
```yaml
runConfig:
  minInstances: 0      # ステージングではコスト削減のため0
  maxInstances: 10
  concurrency: 100
  cpu: 2
  memoryMiB: 4096

env:
  # 公開情報（Firebase Client SDK）
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSy...
    availability: [BUILD, RUNTIME]

  # シークレット（Secret Manager参照）
  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: firebase-admin-private-key
    availability: [BUILD, RUNTIME]

# Cloud SQL接続
cloudSqlInstances:
  - connectionName: nukune-stg:asia-northeast1:nukune-stg-mysql
```

**注意**: ステージング環境では `apphosting.staging.yaml` という名前でファイルを作成してください。本番環境の `apphosting.yaml` と分離することをお勧めします。

### 4.6 デプロイの実行

1. 「バックエンドを作成」をクリック
2. 初回ビルドが自動的に開始されます
3. ビルド完了を待ちます（10-15分程度）

### 4.7 デプロイ後の確認

1. デプロイが完了したら、提供されたURLにアクセス
2. アプリが正常に動作することを確認
3. Firebase Authenticationでログインできることを確認
4. データベース接続が正常か確認

---

## 手順5: Cloud SQLとの接続設定

### 5.1 Cloud SQL Proxy接続の設定（推奨）

Firebase App Hosting（Cloud Run）からCloud SQLに接続する場合:

1. GCP Console > Cloud Run > サービス を開く
2. デプロイされたサービス `nukune-staging` を選択
3. 「新しいリビジョンを編集してデプロイ」をクリック
4. 「接続」タブを選択
5. 「Cloud SQL 接続を追加」
6. 作成したCloud SQLインスタンス `nukune-stg-mysql` を選択
7. 「デプロイ」をクリック

### 5.2 環境変数の更新

Cloud SQL接続名を環境変数に設定:

```
MYSQL_HOST=/cloudsql/nukune-stg:asia-northeast1:nukune-stg-mysql
```

または、TCP接続の場合:
```
MYSQL_HOST=<CLOUD_SQL_PRIVATE_IP>
MYSQL_PORT=3306
```

---

## 手順6: 自動デプロイ（Git連携）の確認

### 6.1 自動デプロイの動作確認

1. `staging` ブランチに変更をプッシュ
```bash
git checkout staging
git add .
git commit -m "test: ステージング環境デプロイテスト"
git push origin staging
```

2. Firebase Console > App Hosting で自動ビルドが開始されることを確認
3. ビルド完了後、新しいリビジョンがデプロイされることを確認

### 6.2 デプロイ通知の設定（オプション）

Firebase Console > App Hosting > 通知 で、Slack/メールへのデプロイ通知を設定可能

---

## 手順7: ネットワーク構成の確認

### 7.1 固定IPアドレスの確認

GCPコンソールで確認:

```bash
# Cloud Shellで実行
gcloud compute addresses list --filter="name=nukune-stg-nat-ip"
```

**期待される出力**:
```
NAME               ADDRESS/RANGE  TYPE      PURPOSE  NETWORK  REGION            SUBNET  STATUS
nukune-stg-nat-ip  xx.xx.xx.xx    EXTERNAL                    asia-northeast1           RESERVED
```

このIPアドレスが、Cloud Run から送信される際の固定IPとなります。

### 7.2 ネットワーク構成確認チェックリスト

以下を確認して、ネットワーククローンが完了していることを確認:

- [ ] VPC Connector が作成されている (`nukune-stg-connector`)
- [ ] Cloud Router が作成されている (`nukune-stg-router`)
- [ ] 静的IPが予約されている (`nukune-stg-nat-ip`)
- [ ] Cloud NAT が設定されている (`nukune-stg-nat`)
- [ ] Cloud Run サービスがVPCに接続されている
- [ ] Cloud SQL が VPC 内で動作している

---

## 最終確認: ネットワーククローン完了チェックリスト

以下をすべて確認できれば、**ステージング環境のネットワーククローンは完了**です：

### ✅ インフラ構成

- [ ] **Firebase プロジェクト** `nukune-stg01-475508` が有効
- [ ] **Firestore Database** が作成されている
- [ ] **Firebase Storage** が作成されている
- [ ] **Firebase Authentication** (メール/パスワード) が有効
- [ ] **Cloud SQL インスタンス** `nukune-stg-mysql` が起動中
- [ ] **データベース** `nukune_stg` とユーザー `nukune_app` が作成済み

### ✅ ネットワーク構成（固定IP）

- [ ] **VPC Connector** `nukune-stg-connector` が作成されている
- [ ] **Cloud Router** `nukune-stg-router` が作成されている
- [ ] **静的IPアドレス** `nukune-stg-nat-ip` が予約されている
- [ ] **Cloud NAT** `nukune-stg-nat` が設定されている
- [ ] 固定IPアドレスが確認できる (`gcloud compute addresses list`)

### ✅ Git連携

- [ ] **Firebase App Hosting** バックエンド `nukune-staging` が作成されている
- [ ] **GitHub連携** で `staging` ブランチが接続されている
- [ ] **初回デプロイ** が成功している（またはビルド実行済み）
- [ ] デプロイされたURLにアクセスできる

### ✅ 環境変数・設定

- [ ] Secret Manager にすべてのシークレットが作成されている（`SECRET_MANAGER_SETUP.md`参照）
- [ ] `apphosting.staging.yaml` が作成され、`staging`ブランチにプッシュ済み
- [ ] Cloud SQL 接続設定が `apphosting.staging.yaml` に含まれている
- [ ] サービスアカウントに Secret Manager アクセス権限が付与されている

---

**これで作業完了です！** アプリケーションの詳細な動作確認は不要です。

---

## トラブルシューティング

### ビルドエラーが発生する場合

1. Firebase Console > App Hosting > ビルドログ を確認
2. Secret Manager とシークレット参照が正しく設定されているか確認（`BUILD_ERROR_FIX.md`参照）
3. `apphosting.staging.yaml` の内容を確認
4. `package.json` の依存関係が最新か確認

### データベース接続エラー

1. Cloud SQL インスタンスが起動しているか確認
2. 接続文字列が正しいか確認（Cloud SQL Proxy形式 vs TCP）
3. ユーザー名・パスワードが正しいか確認
4. Cloud Runサービスに Cloud SQL 接続が追加されているか確認

### VPC/固定IPが機能しない

1. VPC Connector が正しく作成されているか確認
2. Cloud Router と Cloud NAT が正しく設定されているか確認
3. `apphosting.yaml` の `vpcAccess` 設定が正しいか確認

### 認証エラー

1. Firebase Console > Authentication > 設定 > 承認済みドメイン
2. ステージング環境のドメインが追加されているか確認

---

## コスト最適化のヒント

ステージング環境では以下の設定でコストを削減できます:

1. **Cloud Run**:
   - `minInstances: 0` (使用しない時は自動停止)
   - `maxInstances: 5` (スケールを制限)
   - `cpu: 2`, `memoryMiB: 4096` (スペックを下げる)

2. **Cloud SQL**:
   - 自動バックアップの頻度を減らす
   - 夜間は停止するスケジュールを設定

3. **Firebase**:
   - 無料枠内で運用できる場合が多い
   - 使用量をモニタリング

---

## 参考リンク

- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [Cloud Run VPC アクセス](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Cloud NAT ドキュメント](https://cloud.google.com/nat/docs)
- [Cloud SQL 接続オプション](https://cloud.google.com/sql/docs/mysql/connect-run)

---

## まとめ

この手順書に従うことで、本番環境と同等のステージング環境を `nukune-stg` GCPプロジェクトに構築できます。特に以下の3点が完了します:

1. ✅ **環境のクローン**: Firebase + MySQL + Cloud Runの構成
2. ✅ **IP固定化**: Cloud NATによる送信元IPの固定
3. ✅ **Git連携**: `staging`ブランチへのpushで自動デプロイ

何か問題が発生した場合は、トラブルシューティングセクションを参照してください。
