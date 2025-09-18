# プロジェクト概要
- Nukuneは日本語対応のマッチングアプリで、安全かつ信頼できる出会い体験を提供することを目的としている。
- Next.js 15 (App Router / React Server Components) と TypeScript を軸に、Firebase (Auth/Firestore/Storage/Admin SDK) と MySQL を併用している。
- Tailwind CSS・Sass・shadcn/ui (Radix UI) を組み合わせたモバイルファーストなUI構成。
- AI/生成系機能には Google Genkit + Google AI プロバイダ (@genkit-ai/googleai) を使用。
- TanStack Query（react-query）でデータ取得、React Contextで認証状態を管理している。
- ルート構成は `src/app` (App Router) と `src/components`, `src/lib`, `src/utils`, `scripts` などに分かれている。