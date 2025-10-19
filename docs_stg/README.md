# ステージング環境構築ドキュメント

このディレクトリには、Nukuneアプリのステージング環境を構築するためのドキュメントが含まれています。

## 📋 作業方針

**重要**: このステージング環境構築は、**ネットワーク的にクローンを作成**することが目的です。

### ✅ 実施すること
- インフラ構成の複製（Firebase、Cloud SQL、VPC、固定IP）
- Git連携の設定（`staging`ブランチ）
- ネットワーク構成の確認

### ❌ 実施しないこと
- アプリケーションレベルの詳細な動作テスト
- 機能の完全な検証
- 本番データのコピー

---

## 📚 ドキュメント一覧

### 1. 📄 STG_ORDER.md
**要件定義書**

クライアントからの要望を記載した元ドキュメント。
- 現在の環境のクローン
- IP固定化
- Git連携

### 2. 🎯 STAGING_PREREQUISITES.md
**事前準備チェックリスト**

構築作業を始める前に必要なものをリストアップ。

**内容**:
- 必要なアカウント（GCP、Firebase、GitHub）
- 必要なAPI・サービスの有効化
- 必要なAPIキー（Google Genkit等）
- パスワード生成方法

**読むタイミング**: 作業開始前に必ず確認

### 3. 📖 STAGING_SETUP.md ⭐
**ステージング環境構築手順書（メイン）**

実際の構築手順を詳細に記載したメインドキュメント。

**構築する内容**:
1. Firebaseプロジェクトのセットアップ
2. Cloud SQL (MySQL) のセットアップ
3. VPCネットワークとIP固定化
4. Firebase App Hostingのセットアップ
5. 環境変数設定（Secret Manager + apphosting.staging.yaml）
6. Cloud SQL接続設定
7. Git連携の確認
8. ネットワーク構成の確認

**所要時間**: 約1.5〜2.5時間

**読むタイミング**: 実際の構築作業時

### 4. 🔧 MYSQL_TESTING_WITHOUT_DATA.md
**MySQL動作確認ガイド（本番データなし）**

本番データをコピーせずに、MySQLが正しく動作しているかを確認する方法。

**テスト方法**:
- 方法1: 最小限のテストテーブル作成（推奨）
- 方法2: スキーマのみコピー
- 方法3: コードからテーブル構造を推測
- 方法4: 既存APIでテスト

**読むタイミング**: MySQLのセットアップ後、接続確認が必要な場合

### 5. 🏗️ INFRASTRUCTURE_OVERVIEW.md
**インフラストラクチャ全体像**

Nukuneアプリのインフラ全体を詳しく解説。

**内容**:
- アーキテクチャ図
- 各コンポーネントの詳細説明
- リクエストフロー例
- コスト見積もり
- セキュリティ設定

**読むタイミング**: 全体像を理解したい場合（オプション）

### 6. 🔐 SECRET_MANAGER_SETUP.md
**Secret Manager + apphosting.staging.yaml セットアップガイド**

環境変数を安全に管理するための詳細手順。

**内容**:
- Secret Manager APIの有効化
- 7つのシークレット作成（コンソールのみ）
- サービスアカウント権限設定
- apphosting.staging.yaml の作成
- トラブルシューティング

**読むタイミング**: 環境変数設定が必要な場合（必須）

### 7. 🔴 BUILD_ERROR_FIX.md
**ビルドエラー修正ガイド**

Firebase App Hostingでのビルドエラーを解決する方法。

**対象エラー**:
- Firebase Admin SDK未初期化
- TRANSACTION_HUB_API_KEY未設定
- MySQL接続エラー

**読むタイミング**: ビルドエラーが発生した場合

---

## 🚀 クイックスタート

ステージング環境を構築する場合、以下の順序で読んでください：

```
1. STG_ORDER.md（要件確認）
   ↓
2. STAGING_PREREQUISITES.md（事前準備）
   ↓
3. STAGING_SETUP.md（実際の構築）★ メイン
   ├→ SECRET_MANAGER_SETUP.md（環境変数設定）★ 必須
   └→ MYSQL_TESTING_WITHOUT_DATA.md（必要に応じて）
```

**最短ルート**: `STAGING_SETUP.md` と `SECRET_MANAGER_SETUP.md` を読んで作業開始。

---

## ✅ 構築完了の判断基準

以下がすべて確認できれば、ステージング環境の構築は完了です：

### インフラ構成
- [ ] Firebase プロジェクト `nukune-stg01-475508` が有効
- [ ] Firestore、Storage、Authentication が作成されている
- [ ] Cloud SQL インスタンス `nukune-stg-mysql` が起動中
- [ ] データベース `nukune_stg` とユーザー `nukune_app` が存在

### ネットワーク構成（固定IP）
- [ ] VPC Connector `nukune-stg-connector` が作成されている
- [ ] Cloud Router `nukune-stg-router` が作成されている
- [ ] 静的IPアドレス `nukune-stg-nat-ip` が予約されている
- [ ] Cloud NAT `nukune-stg-nat` が設定されている

### Git連携
- [ ] Firebase App Hosting バックエンド `nukune-staging` が作成されている
- [ ] GitHub `staging` ブランチと連携されている
- [ ] 初回デプロイが成功している（またはビルド実行済み）

---

## 💰 推定コスト

**月額**: 約 $50-90

- Cloud Run: $10-20（minInstances=0）
- Cloud SQL: $30-50（小型インスタンス、夜間停止推奨）
- その他（Firestore, Storage, NAT, VPC）: $10-20

**コスト削減のヒント**:
- Cloud SQLを夜間・休日に停止
- Cloud Runの`minInstances`を0に設定
- 使用しない時はプロジェクト全体を停止

---

## 📞 トラブルシューティング

問題が発生した場合:

1. **エラーメッセージを記録**
2. **どの手順で発生したか確認**
3. `STAGING_SETUP.md` のトラブルシューティングセクションを確認
4. それでも解決しない場合は、チームに相談

---

## 🔗 関連リンク

- [Firebase Console](https://console.firebase.google.com)
- [GCP Console](https://console.cloud.google.com)
- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [Cloud NAT ドキュメント](https://cloud.google.com/nat/docs)

---

## 📝 更新履歴

- 2025-10-18: 初版作成
  - STG_ORDER.mdの要件に基づき、ネットワークレベルのクローン作成にフォーカス
  - アプリケーションレベルのテストは不要と明記

---

**Good luck with the staging environment setup! 🚀**
