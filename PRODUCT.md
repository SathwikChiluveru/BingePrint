# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friend groups who watch Netflix. One person uploads their history, sees their own wrapped, then pulls friends in with an invite code so the group can compare and tease each other's habits. The solo wrapped is the entry point; the group comparison is the reason to come back and share.

## Product Purpose

Autoplayed turns a Netflix viewing-history CSV into an animated "wrapped" slideshow (total hours, top shows, longest binge, viewing patterns, a personality label) and lets friends join a group to compare their stats side by side. Success is a user finishing their wrapped and getting at least one friend to join their group.

## Positioning

- **Privacy-first:** the CSV is parsed and analyzed entirely in the browser and never uploaded. Only the computed stats are stored, and they leave the device only when the user joins a group.
- **Group comparison:** head-to-head stats with friends via invite codes, which Netflix itself does not offer.
- **Any time, all-time:** covers the whole viewing history whenever the user wants, not a once-a-year December release.
- **Roast tone:** personality labels and copy tease the viewer instead of flattering them.

## Operating Context

- Users get their data from Netflix in one of two ways:
  - Quick export: netflix.com/viewingactivity, "Download all", producing `NetflixViewingHistory.csv` (columns `Title,Date`, date only).
  - Full data request: Account > Security & Privacy > Download your personal information, producing `CONTENT_INTERACTION/ViewingActivity.csv` (with start times and durations).
- Upload happens on desktop or phone. The wrapped slideshow is swipeable and meant to be screenshotted and shared.
- Groups are joined by an 8-character invite code shared out-of-band (group chats).

## Capabilities and Constraints

- Stack: Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (Postgres, Auth with Google OAuth and email magic link, RLS), Framer Motion, Zustand with localStorage, PapaParse.
- The quick export has no time of day or durations. Watch time is estimated from episode/movie counts and must be labeled as an estimate. Time-of-day stats (night owl, peak hour) are hidden for that export.
- Viewing your own reel needs no account. Creating or joining a group requires sign-in, and sends that member's computed summary stats (never the file) to the server.
- Terminology: "Autoplayed" is the product; "reel" is the user's own slideshow (never "my Autoplayed"); "group", "invite code", "binge" (a long single sitting, or a single day for date-only data).

## Brand Commitments

- Name: Autoplayed.
- Netflix-inspired dark palette is allowed, but the product is clearly unofficial: say it is not affiliated with Netflix, and never use the Netflix logo or wordmark.
- Voice: playful, teasing, roast-style; never mean about anything beyond viewing habits.

## Evidence on Hand

- Real sample data: `testdata/NetflixViewingHistory.csv` (owner's own quick export, about 5,600 rows from 2020 to 2026).
- No users, testimonials, press, or usage numbers exist yet. Do not invent them.

## Product Principles

1. The data never leaves the browser unless the user chooses to join a group. Say so plainly where it matters.
2. Groups are the point. Every solo surface should make inviting a friend the obvious next step.
3. Be honest about estimates. When a number is inferred, mark it.
4. Tease, don't flatter. The copy should make people want to screenshot it.

## Accessibility & Inclusion

No product-specific requirement established beyond WCAG AA basics (contrast, keyboard access, reduced motion).
