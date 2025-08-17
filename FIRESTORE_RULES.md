# Firestore セキュリティルール設定ガイド

## 重要：LINEブラウザ対応のためのルール設定

LINEブラウザやngrok環境でFirebaseが正しく動作するように、以下のセキュリティルールを設定してください。

### Firebase Console での設定手順

1. [Firebase Console](https://console.firebase.google.com) にアクセス
2. プロジェクトを選択
3. 左メニューから「Firestore Database」を選択
4. 上部タブから「ルール」をクリック
5. 以下のルールをコピー＆ペースト

### 推奨セキュリティルール

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーの判定
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // 自分のユーザーIDかチェック
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      // 認証済みユーザーは全てのプロフィールを読める
      allow read: if isAuthenticated();
      // 自分のデータのみ書き込み可能
      allow write: if isOwner(userId);
    }
    
    // Likes collection
    match /likes/{likeId} {
      // 認証済みユーザーは読み書き可能
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.from;
      allow update: if isAuthenticated() && 
        (request.auth.uid == resource.data.from || request.auth.uid == resource.data.to);
      allow delete: if isAuthenticated() && request.auth.uid == resource.data.from;
    }
    
    // Matches collection
    match /matches/{matchId} {
      // マッチに関わるユーザーのみアクセス可能
      allow read: if isAuthenticated() && 
        request.auth.uid in resource.data.users;
      allow write: if isAuthenticated() && 
        request.auth.uid in request.resource.data.users;
      
      // マッチ内のメッセージ
      match /messages/{messageId} {
        allow read: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.users;
        allow create: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.users;
      }
    }
    
    // Communities collection
    match /communities/{communityId} {
      // 認証済みユーザーは読み込み可能
      allow read: if isAuthenticated();
      // 認証済みユーザーはコミュニティ作成可能
      allow create: if isAuthenticated();
      // メンバーのみ更新可能
      allow update: if isAuthenticated() && 
        (request.auth.uid in resource.data.members || 
         request.auth.uid == resource.data.createdBy);
      
      // コミュニティ内の投稿
      match /posts/{postId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/communities/$(communityId)).data.members;
        allow update: if isAuthenticated() && 
          request.auth.uid == resource.data.authorId;
        allow delete: if isAuthenticated() && 
          request.auth.uid == resource.data.authorId;
      }
    }
    
    // Memos collection
    match /memos/{memoId} {
      // 作成者のみアクセス可能
      allow read: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
      allow update: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
    }
    
    // Profile Views collection
    match /profileViews/{viewId} {
      // 認証済みユーザーは作成可能
      allow create: if isAuthenticated();
      // 関係者のみ読み込み可能
      allow read: if isAuthenticated() && 
        (request.auth.uid == resource.data.viewerUserId || 
         request.auth.uid == resource.data.viewedUserId);
    }
  }
}
```

### 注意事項

1. **有料会員限定機能について**
   - セキュリティルール側では有料会員チェックを行わない
   - アプリケーション側（フロントエンド）で制御
   - これによりLINEブラウザでも正しく動作

2. **本番環境での対応**
   - 本番環境では、Cloud Functionsを使用して有料会員チェックを実装することを推奨
   - セキュリティルール内でカスタムクレームを使用する方法も検討

3. **デバッグ時の確認**
   - Firebase Consoleの「ルール」タブにあるシミュレーターで動作確認
   - 認証済みユーザーとしてテスト実行

### トラブルシューティング

エラー「Missing or insufficient permissions」が出る場合：
1. 上記のルールが正しく設定されているか確認
2. Firebase Authenticationでユーザーがログインしているか確認
3. Firestoreのデータ構造が正しいか確認（users/{userId}など）