# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check (no emit)
```

## Architecture

**Next.js 15 App Router** with `src/` directory and `@/*` path alias.

### Data flow
1. User uploads Netflix CSV → `src/lib/csv/parser.ts` parses to `NetflixEntry[]`
2. `src/lib/csv/stats.ts` computes `WrappedStats` from entries (client-side, never hits server)
3. `WrappedStats` stored in Zustand + localStorage via `src/lib/store.ts`
4. `sessionId` (random 8-char string) used as URL param at `/wrapped/[sessionId]`

### Groups flow
- `POST /api/groups` — create group (auth required)
- `GET /api/groups/[groupId]` — fetch group + members
- `POST /api/groups/[groupId]/members` — join group with `wrapped_data` JSON (rate limited)
- Groups identified by `invite_code` (8-char random); users join by code at `/groups`

### Auth
- Supabase Auth (Google OAuth + email magic link)
- `src/middleware.ts` protects `/wrapped/*` and `/groups/create`
- Auth callback at `/auth/callback`

### Key files
- `src/types/index.ts` — all shared types (`NetflixEntry`, `WrappedStats`, `Group`, `GroupMember`)
- `src/lib/csv/parser.ts` — Netflix CSV → `NetflixEntry[]`, validates required headers
- `src/lib/csv/stats.ts` — computes all 10 wrapped stats from entries
- `src/components/wrapped/SlideShow.tsx` — 10-slide swipeable wrapped viewer
- `supabase/migrations/001_init.sql` — full DB schema + RLS policies

### Styling
- Tailwind v4 (CSS-first, no config file)
- Design tokens in `src/styles/tokens.css` (imported in `globals.css`)
- Netflix dark palette: `--color-bg: #141414`, `--color-red: #e50914`
- Utility classes: `.card`, `.glass`, `.btn-primary`, `.text-gradient-red`

## Setup

Copy `.env.local.example` to `.env.local` and fill in Supabase credentials.
Run `supabase/migrations/001_init.sql` in your Supabase SQL editor.
Enable Google OAuth and email magic link in Supabase Auth settings.
