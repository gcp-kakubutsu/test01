# コードスタイル・設計方針
- TypeScriptのstrictモードを前提にし、型定義（interface/type）を積極的に利用する。
- Reactの関数コンポーネント (App Router) を採用し、必要に応じてサーバー/クライアントコンポーネントを切り分ける。
- スタイリングはTailwind CSS、shadcn/ui（Radix UI）、Sassを必要に応じて使い分ける。
- データ取得は TanStack Query を中心に行い、認証周りはReact Contextを利用する。
- パスエイリアス `@/*` が `src/*` にマッピングされている。
- ESLint (Next.js推奨設定) と Prettier互換スタイルを維持し、不要なロジック／コメントの追加を避ける。