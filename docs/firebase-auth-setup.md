# Firebase Authentication メールテンプレート設定

## カスタムアクションハンドラーURLの設定

Firebase Console で以下の手順を実行してください：

1. [Firebase Console](https://console.firebase.google.com) にアクセス
2. プロジェクトを選択
3. 左メニューから「Authentication」を選択
4. 「Templates」タブをクリック
5. 各テンプレート（パスワードリセット、メールアドレス確認など）で：
   - 「編集」をクリック
   - 「Action URL」を以下に変更：
     ```
     https://your-domain.com/auth/action
     ```
     （`your-domain.com` は実際のドメインに置き換えてください）
   - 「保存」をクリック

## テンプレートのカスタマイズ

各テンプレートで以下をカスタマイズできます：

- **件名**: メールの件名
- **送信者名**: 表示される送信者名
- **メッセージ**: メール本文（HTMLとプレーンテキスト）
- **アクションURL**: カスタムハンドラーのURL

## 開発環境での設定

開発環境では、ngrok などのツールを使用して localhost を公開し、そのURLを Action URL として設定することができます。

```bash
# ngrok を使用する場合
ngrok http 9002
```

生成された URL（例：`https://xxxxx.ngrok.io`）を Action URL として設定します。

## 本番環境での設定

本番環境では、実際のドメイン（例：`https://nukune.com`）を使用してください。