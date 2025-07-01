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
