# Firebase Firestoreインデックス設定

## ✅ インデックス作成済み

**注意**: 現在、重複したインデックスが存在しています。以下の手順で削除してください。

### 重複インデックスの削除
1. [Firebase Console インデックス画面](https://console.firebase.google.com/project/nukune/firestore/indexes)を開く
2. `posts`コレクションの2つのインデックスのうち、**1つを削除**
3. どちらも同じ設定なので、どちらを削除しても問題ありません

## 必要なインデックス

コミュニティ機能を正常に動作させるために、以下のインデックスをFirebase Consoleで作成する必要があります。

### 1. Postsコレクション用インデックス

**コレクション**: `posts`
**フィールド**:
- `communityId` (昇順)
- `timestamp` (降順)

### Firebase Consoleでの作成手順

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト「nukune」を選択
3. 左メニューから「Firestore Database」を選択
4. 「インデックス」タブをクリック
5. 「インデックスを作成」ボタンをクリック
6. 以下の設定を入力：
   - コレクションID: `posts`
   - フィールド1: `communityId` → 昇順
   - フィールド2: `timestamp` → 降順
   - クエリスコープ: コレクション
7. 「作成」をクリック

### エラーメッセージからの自動作成

もし以下のようなエラーメッセージが表示された場合：

```
The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/nukune/firestore/indexes?create_composite=...
```

エラーメッセージ内のリンクをクリックすると、必要なインデックスが自動的に設定された状態でFirebase Consoleが開きます。「作成」ボタンをクリックするだけで完了します。

## インデックス作成の確認

インデックスの作成には数分かかる場合があります。作成中は以下のように表示されます：
- ステータス: 「作成中」

作成が完了すると：
- ステータス: 「有効」

## トラブルシューティング

### "Missing or insufficient permissions"エラーが続く場合

1. **Firestoreルールの確認**
   - Firebase Console → Firestore Database → ルール
   - 認証されたユーザーがコミュニティと投稿を読めることを確認

2. **コレクションの初期化**
   - アプリケーションを開いてコミュニティページにアクセス
   - 自動的に初期コミュニティが作成されます

3. **ブラウザキャッシュのクリア**
   - ブラウザのキャッシュをクリアして再度ログイン

4. **Firebase認証の確認**
   - Firebase Console → Authentication
   - ユーザーが正しく登録されていることを確認

## 注意事項

- インデックスは本番環境と開発環境で共有されます
- 一度作成したインデックスは、不要になっても削除することを推奨します（パフォーマンスとコストの観点から）
- 複合インデックスは自動では作成されないため、手動で作成する必要があります