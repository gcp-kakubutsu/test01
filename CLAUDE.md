# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nukune (ヌクネ) is a Next.js 15 dating/matching application with Firebase backend and AI capabilities. The app focuses on safe, verified connections with Instagram-inspired UI in Japanese.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 9002 with Turbopack)
npm run dev

# AI development server
npm run genkit:dev

# Build for production
npm run build

# Run production server
npm run start

# Code quality checks (run before committing)
npm run lint
npm run typecheck
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 15.3.3 App Router with React Server Components
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Firebase (Auth, Firestore) + Google Genkit for AI
- **State**: React Context (auth) + TanStack Query (data fetching)
- **Forms**: react-hook-form + Zod validation

### Key Patterns
1. **Authentication**: AuthContext wrapper at `src/contexts/AuthContext.tsx` handles Firebase Auth state
2. **Firebase Client**: Initialized at `src/lib/firebase/client.ts` with comprehensive error handling
3. **AI Flows**: Genkit flows in `src/ai/flows/` for profile verification
4. **Components**: shadcn/ui components in `src/components/ui/`
5. **Path Aliases**: Use `@/*` for imports from `src/*`

### Environment Variables
Required in `.env.local` (see `.env.example`):
- Firebase config: `NEXT_PUBLIC_FIREBASE_*`
- Genkit: `GOOGLE_GENKIT_API_KEY`

### Deployment
- Firebase App Hosting via `apphosting.yaml`
- Deploys to Cloud Run with automatic scaling

## Important Notes
- All JSON files are gitignored for security
- Build errors from TypeScript/ESLint are ignored in production
- Port 9002 is used for development (not default 3000)
- UI is primarily in Japanese with mobile-first design
- Primary color scheme: Magenta (#F0306A) with light pink background (#F9E4EB)

## Task Management Rules

### Ticket System
- Feature tickets are stored in `/docs` directory as markdown files
- File naming convention: `XXX_機能名.md` (e.g., `001_セキュリティルール更新.md`)
- Sequential numbering indicates implementation priority
- Each ticket contains:
  - **機能概要**: Feature purpose and overview
  - **詳細要件**: Specific implementation requirements
  - **Todoリスト**: Task checklist with `- [ ]` for pending, `- [x]` for completed
  - **依存関係**: Dependencies on other features
  - **受け入れ基準**: Completion criteria
  - **実装ファイル**: Files to be modified/created
  - **推定工数**: Estimated time

### Progress Tracking
- Update todo status in tickets as tasks are completed: `- [x]` 
- Mark tickets as complete when all acceptance criteria are met
- Current implementation status can be checked in each ticket file

### Current Active Tickets
Check `/docs` directory for the list of implementation tickets.
Use sequential numbering to understand priority order.

## Development Process

### Pre-Implementation Mindset
**重要**: 毎回プロンプトに真剣に考えてから実装を始めて下さい。

すべての実装作業において、以下のプロセスを必ず実行してください：

1. **要件の理解**: プロンプトや仕様を慎重に読み、何を求められているかを正確に把握する
2. **影響範囲の分析**: 変更が他のコンポーネントやシステムに与える影響を検討する
3. **実装戦略の検討**: 最適なアプローチと潜在的な問題点を事前に特定する
4. **品質基準の確認**: コード品質、セキュリティ、パフォーマンスの観点から検証する

この思考プロセスを経てから、実際のコーディング作業に着手してください。
真剣に考えてから実装して下さい。