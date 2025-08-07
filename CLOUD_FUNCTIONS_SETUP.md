# Cloud Functions セットアップガイド

## 概要
このプロジェクトでは、管理者権限による投稿削除などの機能をCloud Functionsで実装しています。

## セットアップ手順

### 1. 依存関係のインストール

```bash
cd functions
npm install
```

### 2. Firebase CLIのインストール（まだの場合）

```bash
npm install -g firebase-tools
```

### 3. Firebaseにログイン

```bash
firebase login
```

### 4. プロジェクトの初期化（既存プロジェクトを使用）

```bash
firebase use your-project-id
```

### 5. 環境変数の設定

管理者のメールアドレスを設定：

```bash
firebase functions:config:set admin.emails="admin1@example.com,admin2@example.com"
```

設定を確認：

```bash
firebase functions:config:get
```

### 6. ローカルでのテスト

```bash
cd functions
npm run serve
```

### 7. Cloud Functionsのデプロイ

```bash
firebase deploy --only functions
```

特定の関数のみデプロイする場合：

```bash
firebase deploy --only functions:deletePostAsAdmin
```

## 実装されている関数

### 1. deletePostAsAdmin
管理者が任意の投稿を削除できる関数

**パラメータ:**
- `postId`: 削除する投稿のID

**レスポンス:**
```javascript
{
  success: true,
  message: "Post and all comments deleted successfully",
  postId: "...",
  deletedBy: "admin@example.com",
  timestamp: "2025-08-07T..."
}
```

### 2. deleteCommentAsAdmin
管理者が任意のコメントを削除できる関数

**パラメータ:**
- `postId`: 投稿のID
- `commentId`: 削除するコメントのID

### 3. setAdminStatus
既存の管理者が他のユーザーの管理者権限を設定/解除できる関数

**パラメータ:**
- `uid`: 対象ユーザーのUID
- `isAdmin`: 管理者権限の有無（true/false）

### 4. deleteCommunity
管理者またはコミュニティ作成者がコミュニティを削除できる関数

**パラメータ:**
- `communityId`: 削除するコミュニティのID

## クライアント側での使用方法

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';

// 管理者として投稿を削除
const deletePostAsAdmin = httpsCallable(functions, 'deletePostAsAdmin');
const result = await deletePostAsAdmin({ postId: 'post123' });
```

## セキュリティ

- すべての管理者関数は、呼び出し元のユーザーが管理者であることを確認します
- 管理者のメールアドレスは環境変数で管理されています
- すべての管理者アクションはログに記録されます

## トラブルシューティング

### エラー: "Firebase Functions が初期化されていません"
クライアント側で`functions`がインポートされていることを確認：
```typescript
import { functions } from '@/lib/firebase/client';
```

### エラー: "permission-denied"
- ユーザーが管理者リストに含まれていることを確認
- 環境変数が正しく設定されていることを確認：
```bash
firebase functions:config:get admin.emails
```

### デプロイエラー
- Node.jsのバージョンが20であることを確認
- TypeScriptのビルドエラーがないことを確認：
```bash
cd functions
npm run build
```

## 注意事項

1. **本番環境へのデプロイ前に必ず環境変数を設定してください**
2. **管理者のメールアドレスは慎重に管理してください**
3. **Cloud Functionsのログを定期的に確認してください**：
   ```bash
   firebase functions:log
   ```