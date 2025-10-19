# ビルドエラー修正ガイド

このドキュメントは、Firebase App Hostingでのビルドエラーを解決するための詳細な手順を説明します。

## 🔴 発生しているエラー

### エラー1: Firebase Admin SDK未初期化
```
Firebase Admin SDK initialization failed: No credentials found.
For production, set FIREBASE_ADMIN_* environment variables.
```

### エラー2: TRANSACTION_HUB_API_KEY未設定
```
Error: TRANSACTION_HUB_API_KEY is not configured
Export encountered an error on /subscription/success/page
```

### エラー3: MySQL接続エラー（ビルド時）
```
Error: connect ECONNREFUSED 127.0.0.1:3306
Location cache refresh failed
```

---

## 🎯 解決策の全体像

ビルドを成功させるには、以下の環境変数を**すべて**設定する必要があります：

1. ✅ Firebase Admin SDK認証情報（3つ）
2. ✅ Transaction Hub APIキー（2つ）
3. ✅ MySQL接続情報（5つ）
4. ✅ その他必須環境変数

### 🔐 設定方法: Secret Manager + apphosting.staging.yaml

Firebase App Hostingでは、環境変数を設定するために**Google Cloud Secret Manager**と**apphosting.staging.yaml**を使用します。

**メリット**:
- ✅ シークレットをGitHubにプッシュしない（最も安全）
- ✅ Google Cloud Secret Managerで暗号化保存
- ✅ バージョン管理が可能
- ✅ `apphosting.staging.yaml`はGitHubに安全にプッシュできる（参照のみ）
- ✅ コンソールのみで完結（CLIコマンド不要）

**このドキュメントでは概要を説明します。詳細な手順は `SECRET_MANAGER_SETUP.md` を参照してください。**

---

## 📋 修正手順の概要

### ステップ1: 必要な情報を準備

以下の情報が必要になります：

#### 1.1 Firebase Admin SDK認証情報

1. **Firebase Consoleにアクセス**
   ```
   https://console.firebase.google.com
   ```

2. **プロジェクトを選択**: `nukune-stg01-475508`

3. **サービスアカウントページを開く**
   - 左上の歯車アイコン ⚙️ → 「プロジェクトの設定」
   - 上部タブ「サービス アカウント」をクリック

4. **新しい秘密鍵を生成**
   - 「新しい秘密鍵の生成」ボタンをクリック
   - JSONファイルがダウンロードされます

このJSONファイルには以下が含まれます：
- `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
- `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
- `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

#### 1.2 その他の情報

- **MySQL パスワード**: Cloud SQLインスタンス作成時に設定
- **Google Genkit APIキー**: [Google AI Studio](https://aistudio.google.com/app/apikey)で取得
- **管理者パスワード・JWT Secret**: ランダムに生成

---

### ステップ2: Secret Managerにシークレットを作成

Google Cloud Consoleで以下のシークレットを作成します：

1. `firebase-admin-private-key`
2. `firebase-admin-client-email`
3. `db-password`
4. `transaction-hub-api-key`
5. `google-genkit-api-key`
6. `api-register-password`
7. `jwt-secret`

**詳細な手順は `SECRET_MANAGER_SETUP.md` を参照してください。**

---

### ステップ3: apphosting.staging.yaml を作成

リポジトリのルートに `apphosting.staging.yaml` を作成し、環境変数とシークレット参照を記述します。

**詳細な手順は `SECRET_MANAGER_SETUP.md` を参照してください。**

---

### ステップ4: GitHubにプッシュして再デプロイ

```bash
# apphosting.staging.yamlを追加
git add apphosting.staging.yaml
git commit -m "feat: add apphosting.staging.yaml with Secret Manager references"

# stagingブランチにプッシュ
git push origin staging
```

#### 4.3 ビルドログの確認

1. Firebase Console > App Hosting > ビルド履歴
2. 最新のビルドをクリック
3. ログを確認

**成功の兆候**:
```
✓ Generating static pages
✓ Finalizing page optimization
Build completed successfully
```

**まだエラーが出る場合**:
- どの環境変数が欠けているかログで確認
- このドキュメントの該当セクションを再確認

---

---

## 🐛 トラブルシューティング

### エラー: "FIREBASE_ADMIN_PRIVATE_KEY is not configured"

**原因**: Secret Managerにシークレットが作成されていない、または権限が不足

**解決方法**: `SECRET_MANAGER_SETUP.md` の以下を確認
- シークレット `firebase-admin-private-key` が作成されているか
- サービスアカウントに「Secret Manager Secret Accessor」ロールが付与されているか
- `apphosting.staging.yaml` で正しく参照されているか

---

### エラー: "TRANSACTION_HUB_API_KEY is not configured"

**原因**: Secret Managerにシークレットが作成されていない

**解決方法**: `SECRET_MANAGER_SETUP.md` を参照して、以下のシークレットを作成
- `transaction-hub-api-key` (値: `stg_test_placeholder_key`)

両方の環境変数（`TRANSACTION_HUB_API_KEY`と`NEXT_PUBLIC_TRANSACTION_HUB_API_KEY`）が`apphosting.staging.yaml`で参照されていることを確認。

---

### エラー: "Secret not found: secret-name"

**原因**: シークレット名のタイポ、またはシークレットが作成されていない

**解決方法**:
1. GCP Console > Secret Manager でシークレット一覧を確認
2. `apphosting.staging.yaml`のシークレット名とSecret Managerのシークレット名が一致しているか確認
3. 存在しない場合は `SECRET_MANAGER_SETUP.md` を参照して作成

---

### エラー: "Permission denied: Secret Manager"

**原因**: サービスアカウントにSecret Manager アクセス権限がない

**解決方法**: `SECRET_MANAGER_SETUP.md` のステップ4を参照
- プロジェクト番号を確認
- サービスアカウント `[番号]-compute@developer.gserviceaccount.com` に権限付与
- すべてのシークレットに「Secret Manager Secret Accessor」ロールを付与

---

### エラー: "connect ECONNREFUSED 127.0.0.1:3306"

**原因**: ビルド時にMySQLに接続しようとしている（正常な動作）

**これは警告です。ビルドは続行されます。**

ランタイムで解決するため、以下を確認：
- `apphosting.staging.yaml` に Cloud SQL 接続設定が含まれているか
- `DB_HOST` が `/cloudsql/nukune-stg:asia-northeast1:nukune-stg-mysql` になっているか

---

### エラー: ビルドが途中で止まる

**原因**: メモリ不足 or タイムアウト

**解決方法**: `apphosting.staging.yaml`で`memoryMiB`を増やす

```yaml
runConfig:
  memoryMiB: 8192  # 8GBに増量
```

---

## ✅ 最終確認チェックリスト

ビルド成功のために、以下をすべて確認：

### Secret Manager

- [ ] Secret Manager APIが有効化されている
- [ ] 7つのシークレットがすべて作成されている:
  - [ ] `firebase-admin-private-key`
  - [ ] `firebase-admin-client-email`
  - [ ] `db-password`
  - [ ] `transaction-hub-api-key`
  - [ ] `google-genkit-api-key`
  - [ ] `api-register-password`
  - [ ] `jwt-secret`
- [ ] すべてのシークレットにサービスアカウント権限が付与されている

### apphosting.staging.yaml

- [ ] ファイルがリポジトリのルートに作成されている
- [ ] すべてのシークレットが正しく参照されている（`secret: シークレット名`）
- [ ] 公開情報（Firebase Client SDK）が記述されている
- [ ] Cloud SQL接続設定が含まれている
- [ ] `staging`ブランチにプッシュ済み

### ビルド確認

- [ ] `staging`ブランチにプッシュした
- [ ] Firebase App Hostingでビルドが開始された
- [ ] ビルドログでエラーがないことを確認
- [ ] デプロイ完了を確認

---

## 🎯 次のステップ

ビルドが成功したら：

1. ✅ デプロイされたURLにアクセス
2. ✅ 基本的な動作確認（ページが表示されるか）
3. ✅ ネットワーク構成の確認（固定IP等）

詳細は `STAGING_SETUP.md` の「最終確認チェックリスト」を参照してください。

---

## 📚 関連ドキュメント

- **`SECRET_MANAGER_SETUP.md`**: Secret Manager + apphosting.staging.yamlの詳細手順（推奨）
- **`STAGING_SETUP.md`**: ステージング環境全体の構築手順
- **`STAGING_PREREQUISITES.md`**: 事前準備チェックリスト

---

## 📞 まだ解決しない場合

1. **ビルドログを確認**: Firebase Console > App Hosting > ビルド履歴
2. **エラーメッセージを特定**: どのシークレットが見つからないか確認
3. **Secret Manager を確認**: GCP Console > Secret Manager でシークレット一覧を表示
4. **権限を確認**: サービスアカウントに「Secret Manager Secret Accessor」ロールが付与されているか
5. **`SECRET_MANAGER_SETUP.md` を再確認**: 手順を最初から見直す
6. **チームに相談**: ログとエラーメッセージを共有

---

## 📌 重要なポイント

- ✅ Firebase Consoleでは環境変数UIは使用できません
- ✅ **Secret Manager + apphosting.staging.yaml** が唯一の方法です
- ✅ 詳細な手順は `SECRET_MANAGER_SETUP.md` を参照
- ✅ すべてコンソールから設定可能（CLIコマンド不要）

---

**Good luck! 🚀**
