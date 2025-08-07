# 管理者権限セットアップガイド

## 概要
このプロジェクトでは、管理者権限をCloud FunctionsのカスタムクレームとFirestoreセキュリティルールで実装しています。

## 初期セットアップ

### 1. Cloud Functionsの環境変数設定

```bash
# Firebase にログイン
firebase login --reauth

# プロジェクトを選択
firebase use your-project-id

# 管理者メールアドレスを設定
firebase functions:config:set admin.emails="admin1@example.com,admin2@example.com"

# 設定を確認
firebase functions:config:get
```

### 2. Cloud Functionsのデプロイ

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 3. 管理者権限の付与

#### 方法1: Firebase Admin SDKを使用（推奨）

Firebase Admin SDKを使用したスクリプトで管理者権限を付与：

```javascript
// scripts/set-admin.js
const admin = require('firebase-admin');

// サービスアカウントキーを使用して初期化
admin.initializeApp({
  credential: admin.credential.cert('./path/to/serviceAccountKey.json')
});

async function setAdminClaim(email) {
  try {
    // メールアドレスからユーザーを取得
    const user = await admin.auth().getUserByEmail(email);
    
    // カスタムクレームを設定
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    
    console.log(`Admin claim set for ${email} (UID: ${user.uid})`);
  } catch (error) {
    console.error('Error setting admin claim:', error);
  }
}

// 管理者に設定したいメールアドレス
setAdminClaim('varuvaru10000@yahoo.co.jp');
```

実行：
```bash
node scripts/set-admin.js
```

#### 方法2: Cloud Function経由（既存の管理者が必要）

既に管理者権限を持つユーザーがいる場合、Cloud Function経由で他のユーザーに権限を付与：

```javascript
// クライアント側のコード
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';

const setAdminStatus = httpsCallable(functions, 'setAdminStatus');

// ユーザーに管理者権限を付与
await setAdminStatus({ 
  uid: 'target-user-uid', 
  isAdmin: true 
});
```

### 4. Firestoreセキュリティルールの更新

Firebaseコンソールで以下のルールを適用：

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. Firestore Database → ルール
3. `firestore.rules`の内容をコピー＆ペースト
4. 「公開」をクリック

## 管理者権限の確認

### クライアント側で確認

```javascript
// 現在のユーザーのトークンを確認
const user = auth.currentUser;
if (user) {
  const tokenResult = await user.getIdTokenResult();
  console.log('Admin claim:', tokenResult.claims.admin);
}
```

### Firebase Consoleで確認

1. Authentication → Users
2. ユーザーの UID をコピー
3. Cloud Shell または Admin SDK で確認：

```javascript
const user = await admin.auth().getUser('USER_UID');
console.log('Custom claims:', user.customClaims);
```

## トラブルシューティング

### 管理者権限が反映されない

1. **トークンをリフレッシュ**
   ```javascript
   await auth.currentUser.getIdToken(true);
   ```

2. **ログアウト＆再ログイン**
   ```javascript
   await auth.signOut();
   // 再度ログイン
   ```

3. **カスタムクレームが設定されているか確認**
   ```bash
   firebase auth:export users.json
   # users.jsonファイルでcustomClaimsを確認
   ```

### Cloud Functionsで権限エラー

1. **環境変数を確認**
   ```bash
   firebase functions:config:get
   ```

2. **Cloud Functionsを再デプロイ**
   ```bash
   firebase deploy --only functions
   ```

### Firestoreルールでアクセス拒否

1. **ルールが最新か確認**
   - `isAdmin()`関数が定義されているか
   - 削除ルールに`|| isAdmin()`が含まれているか

2. **カスタムクレームが正しく設定されているか確認**
   ```javascript
   const tokenResult = await user.getIdTokenResult();
   console.log('Token claims:', tokenResult.claims);
   ```

## セキュリティ注意事項

1. **管理者メールアドレスは環境変数で管理**
   - ハードコーディングしない
   - `.env`ファイルはGitにコミットしない

2. **サービスアカウントキーの管理**
   - 絶対にGitにコミットしない
   - 安全な場所に保管
   - 本番環境では環境変数を使用

3. **定期的な監査**
   - 管理者リストを定期的に確認
   - 不要な管理者権限は削除
   - Cloud Functionsのログを監視

## 管理者ができること

- ✅ 任意の投稿を削除
- ✅ 任意のコメントを削除
- ✅ 任意のコミュニティを削除
- ✅ 他のユーザーに管理者権限を付与/剥奪

## 推奨事項

1. **初期管理者の設定**
   - プロジェクト所有者を最初の管理者に設定
   - Admin SDKスクリプトで設定

2. **管理者の追加**
   - Cloud Function経由で追加（監査ログが残る）
   - 必要最小限の人数に限定

3. **監査ログ**
   - Cloud Functionsのログを定期的に確認
   - 管理者アクションを追跡