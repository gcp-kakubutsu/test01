# セキュリティガイド - Nukune

## 🚨 GitHubにアップロードしてはいけないファイル

### 絶対にアップロードしないでください：

1. **`.env`** ファイル
   - Firebase APIキー
   - Gemini APIキー  
   - その他の秘密情報が含まれています

2. **`nukune-e72e97115cbd.json`** 
   - Firebase サービスアカウントの秘密鍵ファイル
   - このファイルがあれば誰でもあなたのFirebaseプロジェクトにアクセスできてしまいます

3. **すべての `.json` ファイル**
   - 現在の `.gitignore` で除外されています
   - package.json以外のJSONファイルには機密情報が含まれている可能性があります

## ✅ アップロード可能なファイル

以下のファイルは安全にGitHubにアップロードできます：

- ソースコード（`src/` フォルダ内のすべて）
- 設定ファイル（`.gitignore`, `next.config.ts`, `tailwind.config.ts` など）
- ドキュメント（`README.md`, `CLAUDE.md`, このファイルなど）
- `.env.example`（実際の値ではなく、プレースホルダーのみ）

## 🔐 セキュリティベストプラクティス

1. **環境変数の管理**
   - 本番環境では環境変数を使用する
   - ローカル開発では `.env` ファイルを使用
   - `.env.example` をチームメンバーと共有

2. **Firebase セキュリティルール**
   - Firestoreのセキュリティルールを適切に設定
   - 認証されたユーザーのみがデータにアクセスできるようにする

3. **APIキーの制限**
   - Firebase ConsoleでAPIキーに制限を設定
   - 特定のドメインからのみアクセスを許可

## 📝 チェックリスト

GitHubにプッシュする前に確認：

- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] サービスアカウントキー（.json）が含まれていない
- [ ] APIキーやパスワードがソースコードに直接書かれていない
- [ ] `git status` で機密ファイルが表示されていない

## 🆘 もし間違えてアップロードしてしまったら

1. **すぐに** GitHubリポジトリを削除またはプライベートに変更
2. すべてのAPIキーを再生成
3. Firebase サービスアカウントキーを無効化して新しいものを作成
4. GitHubの履歴からファイルを完全に削除（BFG Repo-Cleanerなどを使用）

参考: https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository