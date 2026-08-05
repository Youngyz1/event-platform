# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## ⚠️ Non-standard Next.js — read the vendored docs before writing code

This repo pins `next@16.2.6`, a version with breaking changes from what you likely know. **Before touching routing, caching, streaming, or navigation code, read the relevant page under `node_modules/next/dist/docs/`** rather than relying on training data. Known deviations found so far:

- **`middleware.ts` is deprecated and renamed to `proxy.ts`.** This project's root-level proxy file is `proxy.ts`, exporting a function named `proxy` (not `middleware`), with the same `config.matcher` shape. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- The docs contain inline `{/* AI agent hint: ... */}` comments calling out non-obvious behavior (e.g. streaming/`loading.md` status-code semantics, `unstable_instant` navigation). Grep `node_modules/next/dist/docs` for `AI agent hint` before making changes to caching, streaming, or navigation — do not assume standard Next.js semantics apply.

## Commands

Standard `npm run` scripts (see `package.json`). Note: `dev` sets `NODE_OPTIONS=--dns-result-order=ipv4first`, forcing IPv4 DNS resolution.

There is no configured test runner (`playwright` is a devDependency but there is no `playwright.config.*` or spec files in the repo, and no `test` script). Don't assume `npm test` works — verify manually or ask before adding a test framework.

## Architecture

**Stack**: Next.js 16 App Router, React 19, Supabase (Postgres + Auth + Storage), Stripe (+ crypto payments), Tailwind v4, Tiptap editor, Resend for email.

### Auth & access control (three layers)

1. **`proxy.ts`** (root) — runs on every matched request. Refreshes the Supabase session, redirects unauthenticated users away from protected routes (`/dashboard`, `/admin`, `/create-event`, `/create-fundraiser`, `/create-organizer`), blocks suspended accounts, and bounces logged-in users away from `/login`/`/signup`. (It previously also gated `/articles/:slug` and `/external-events/ticketmaster/:id` with a pre-streaming existence/visibility check, per this Next.js version's streaming semantics where `notFound()` can no longer change the HTTP status code once the response has started streaming with 200 — both gates were removed along with their now-deleted pages.)
2. **`app/admin/layout.tsx`** — calls `requireAdmin()` (from `lib/auth.ts`) for role enforcement on everything under `/admin`.
3. **`lib/auth.ts`** — server-only RBAC helpers (`getCurrentUser`, `getCurrentUserProfile`, `isAdmin`, `isOrganizer`, `requireAdmin`, `requireAuth`). Role/status checks use a service-role Supabase client to bypass RLS for the `profiles` lookup; never import these in client components.

### Supabase clients — pick the right one

- `lib/supabase.ts` — browser client (`createBrowserClient`), for client components.
- `lib/supabase-server.ts` — `createSupabaseServer()`, async, reads/writes cookies via `next/headers`; use in Server Components, Server Actions, Route Handlers.
- `lib/supabase-admin.ts` — service-role client, bypasses RLS. Only use server-side for privileged operations (role checks, admin mutations, webhook processing); never expose to the client.
- DB schema lives in `db/` as sequential `migration_NN_*.sql` files (currently up to 36) plus feature schema files (`*_schema.sql`) and a consolidated `schema.sql`. Check the latest migration number before adding a new one.

### Domain areas (mirrors `app/` route groups and `app/api/`)

- **Fundraisers**: core listings, with a create flow (`create-fundraiser`), dashboard management, and public detail pages at `/fundraisers/[slug]`.
- **Organizers**: public profile pages at `/org/[slug]` — Organizer, Business, Event Organizer, and Community are all the same `organizers` table, differentiated only by an `org_type` badge — plus a create flow (`create-organizer`) and dashboard management. A separate `businesses` table exists (`migration_36_business_listings.sql`) but has no pages built against it yet.
- **Events**: the platform has pivoted to fundraising-only. Public event browsing, `create-event`, and admin event management have all been removed; the `events`/`ticket_orders` tables and their historical data remain (referenced by admin stats and per-organizer/user counts only — not a live, manageable domain).
- **Payments**: Stripe (`@stripe/stripe-js`, `@stripe/react-stripe-js`) plus a custom crypto payment path; webhook handling under `app/api/webhooks/stripe`. Flow spans `create-payment-intent`, `receipts`, `certificates`.
- **External imports**: GoFundMe sync (`app/api/gofundme-sync`, `db/gofundme_sources_schema.sql`) plus a generic `import-url` endpoint, feeding `app/import`. Eventbrite sync and Ticketmaster external-events browsing have been removed.
- **Admin**: `app/admin/*` (fundraisers, organizers, payments, reviews, settings, users, homepage CMS) — moderation panels with stats/filters/search/row actions, gated by `requireAdmin()`.
- **Scheduled jobs** (`vercel.json` crons): `/api/cron/daily-post` (14:00 UTC) and `/api/cron/promotion-engine` (18:00 UTC); logic lives in `lib/promotionEngine.js` and related `lib/*` modules.

### Security headers / CSP

`next.config.ts` builds a strict CSP dynamically (allowing Stripe, Supabase origin, Google Analytics, OpenStreetMap tiles, etc.) and disables `unsafe-eval` in production, gated on **both** `NODE_ENV` and Vercel's `VERCEL_ENV` (the latter can't be spoofed by a misconfigured `.env`). When adding a new third-party origin (images, fonts, iframes, XHR), update the corresponding directive array here rather than loosening `default-src`.

### Misc

- `scratch/` is git-ignored from lint and is where throwaway debug/simulation scripts belong (e.g. webhook simulators) — don't put real code there.
- `hooks/` holds shared client hooks (`use-dashboard-export`, `use-dashboard-params`, `use-image-upload`); prefer these over ad hoc `useState`/`useEffect` duplication in dashboard/admin pages.
