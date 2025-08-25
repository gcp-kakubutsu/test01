# 🚨 緊急対処法：Firebase App Hostingのバックエンドを再作成

## 問題
- 同じリビジョン (studio-a-6azqxz13n2er) が繰り返し使用される
- 権限を修正してもデプロイが失敗する
- 新しいコミットをプッシュしても反映されない

## 解決策：バックエンドの再作成

### 手順1: 現在のバックエンドを削除
```bash
firebase apphosting:backends:delete studio --project nukune
```

### 手順2: 新しいバックエンドを作成
```bash
firebase apphosting:backends:create --project nukune
```

### 手順3: GitHubリポジトリを再接続
- 対話形式でGitHubリポジトリを選択
- ブランチは `master` を選択

### 手順4: 初回デプロイ
```bash
git push origin master
```

## なぜこれで解決するか
- 内部状態がリセットされる
- 新しいCloud Runサービスが作成される
- 正しい権限設定で開始される
- キャッシュ問題が解消される

## 注意事項
- URLが変わる可能性がある
- 一時的にダウンタイムが発生する
- 設定は apphosting.yaml から自動的に読み込まれる