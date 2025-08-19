# Firebase Firestoreのデプロイ方法

## 概要
このドキュメントでは、Firestoreのセキュリティルールとインデックスをデプロイする方法を説明します。

## 前提条件
- Firebase CLIがインストールされていること
- Firebaseプロジェクトにログインしていること
- プロジェクトのルートディレクトリにいること

## デプロイコマンド

### 1. すべてのFirestore設定をデプロイ（推奨）
```bash
firebase deploy --only firestore
```
このコマンドは以下を同時にデプロイします：
- セキュリティルール（`firestore.rules`）
- インデックス（`firestore.indexes.json`）

### 2. セキュリティルールのみデプロイ
```bash
firebase deploy --only firestore:rules
```

### 3. インデックスのみデプロイ
```bash
firebase deploy --only firestore:indexes
```

## デプロイ前の確認

### ローカルでの検証
```bash
# ルールの検証
firebase emulators:start --only firestore

# デプロイ内容のプレビュー
firebase deploy --only firestore --dry-run
```

## Webコンソールからの設定方法

### Firebase Consoleへのアクセス
1. **Firebase Console**: https://console.firebase.google.com/
2. プロジェクト「nukune」を選択
3. 左メニューから「Firestore Database」を選択

### セキュリティルールの設定（Web）
1. **直接URL**: https://console.firebase.google.com/project/nukune/firestore/rules
2. または、Firestore Database → 「ルール」タブ
3. ルールエディタで編集
4. 「公開」ボタンをクリックして適用

### インデックスの設定（Web）
1. **直接URL**: https://console.firebase.google.com/project/nukune/firestore/indexes
2. または、Firestore Database → 「インデックス」タブ
3. 「インデックスを追加」ボタンをクリック
4. 必要なフィールドと並び順を設定
5. 「作成」をクリック

### 複合インデックスの手動作成手順
1. インデックスタブで「インデックスを追加」をクリック
2. コレクショングループを指定（例：`memoHistory`）
3. フィールドを追加：
   - フィールド1: `userId`（昇順）
   - フィールド2: `targetId`（昇順）  
   - フィールド3: `createdAt`（降順）
4. 「作成」をクリック（作成には数分かかります）

### インデックス作成状態の確認
- **URL**: https://console.firebase.google.com/project/nukune/firestore/indexes
- ステータス列で「作成中」または「有効」を確認
- 作成中のインデックスは使用できません

## トラブルシューティング

### インデックスエラーが発生した場合
アプリケーションで「The query requires an index」エラーが表示された場合：

1. エラーメッセージのURLをクリックしてFirebaseコンソールで手動作成
2. または、`firestore.indexes.json`に追加してデプロイ
3. Web コンソールから手動で作成（上記参照）

### デプロイが失敗する場合
```bash
# Firebaseプロジェクトの再設定
firebase use --add

# キャッシュクリア
rm -rf .firebase/

# 再デプロイ
firebase deploy --only firestore
```

## 重要なファイル

### firestore.rules
- **場所**: `/firestore.rules`
- **内容**: セキュリティルール
- **用途**: コレクションへのアクセス権限を定義

### firestore.indexes.json
- **場所**: `/firestore.indexes.json`
- **内容**: 複合インデックスの定義
- **用途**: 複数フィールドでのクエリを高速化

## デプロイ履歴の確認
```bash
# 最近のデプロイ履歴を表示
firebase hosting:channel:list

# プロジェクトの状態確認
firebase projects:list
```

## 注意事項
- インデックスの作成には数分かかる場合があります
- セキュリティルールは即座に反映されます
- 本番環境へのデプロイ前に必ずテスト環境で検証してください

## 現在のインデックス一覧
- `posts`: communityId + timestamp
- `communities`: memberCount
- `likes`: from + to
- `matches`: users + matchedAt
- `memos`: userId + updatedAt
- `memoHistory`: userId + targetId + createdAt
- `memoHistory`: userId + targetId + date + createdAt