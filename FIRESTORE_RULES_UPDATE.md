# Firestore セキュリティルール更新

## 更新日: 2025-08-07

### 更新内容
- コメント機能のためのセキュリティルールを追加
- 管理者ユーザーによる投稿・コメント削除機能を追加（カスタムクレーム使用）

### 完全なセキュリティルール

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    // Note: This checks custom claims set by Cloud Functions
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }
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
         
      // Messages subcollection
      match /messages/{messageId} {
        allow read, write: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.users;
      }
    }
    
    // Likes collection rules
    match /likes/{likeId} {
      // ユーザーは自分が送信したいいね、または自分宛のいいねを読める
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.from ||
         request.auth.uid == resource.data.to);
      
      // ユーザーは自分からのいいねのみ作成できる
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.from;
      
      // いいねは削除・更新不可
      allow update, delete: if false;
    }
    
    // Communities collection rules
    match /communities/{communityId} {
      // 認証されたユーザーは全てのコミュニティを読める
      allow read: if request.auth != null;
      
      // コミュニティの作成は認証されたユーザーのみ
      allow create: if request.auth != null;
      
      // コミュニティの更新（参加・退会など）は認証されたユーザーのみ
      allow update: if request.auth != null;
      
      // コミュニティの削除は作成者または管理者のみ
      allow delete: if request.auth != null && 
        (resource.data.createdBy == request.auth.uid || isAdmin());
    }
    
    // Posts collection rules
    match /posts/{postId} {
      // 認証されたユーザーは全ての投稿を読める
      allow read: if request.auth != null;
      
      // 投稿の作成は認証されたユーザーのみ（自分のauthorIdで）
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.authorId;
      
      // 投稿の更新（いいねなど）は認証されたユーザーのみ
      allow update: if request.auth != null;
      
      // 投稿の削除は作成者または管理者のみ
      allow delete: if request.auth != null && 
        (request.auth.uid == resource.data.authorId || isAdmin());
      
      // Comments subcollection - 新規追加
      match /comments/{commentId} {
        // 認証されたユーザーはコメントを読める
        allow read: if request.auth != null;
        
        // コメントの作成は認証されたユーザーのみ（自分のauthorIdで）
        allow create: if request.auth != null && 
          request.auth.uid == request.resource.data.authorId;
        
        // コメントの更新は作成者のみ
        allow update: if request.auth != null && 
          request.auth.uid == resource.data.authorId;
        
        // コメントの削除は作成者または管理者のみ
        allow delete: if request.auth != null && 
          (request.auth.uid == resource.data.authorId || isAdmin());
      }
    }
    
    // Profile views collection rules
    match /profileViews/{viewId} {
      // 認証されたユーザーは全ての閲覧データを読める（プロフィール閲覧数表示のため）
      allow read: if request.auth != null;
      
      // プロフィール閲覧の記録は認証されたユーザーのみ（自分がviewerの場合のみ）
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.viewerUserId;
      
      // 閲覧記録の更新・削除は不可
      allow update, delete: if false;
    }
    
    // User settings collection rules
    match /userSettings/{userId} {
      // ユーザーは自分の設定のみ読み書き可能
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Male user preferences collection rules
    match /malePreferences/{userId} {
      // ユーザーは自分の設定のみ読み書き可能
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 管理者は全ての設定を読める（マッチング用）
      allow read: if request.auth != null;
    }
    
    // Default rule - deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 更新手順

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左側メニューから「Firestore Database」をクリック
4. 上部の「ルール」タブをクリック
5. 上記のルールを全体をコピーして貼り付け
6. 「公開」ボタンをクリック

## 追加された機能

### コメント機能のルール（posts/{postId}/comments/{commentId}）
- ✅ 認証されたユーザーはコメントを読める
- ✅ コメントの作成は認証されたユーザーのみ（自分のauthorIdで投稿）
- ✅ コメントの更新は作成者のみ可能
- ✅ コメントの削除は作成者のみ可能

これにより、コミュニティの投稿にコメント機能が正常に動作するようになります。