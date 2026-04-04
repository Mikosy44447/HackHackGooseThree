# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

HarnoldAlert is a civic-tech app that tracks US Congressional bills, federal regulations, executive orders, and federal court decisions, then delivers personalized legislative digests. It has two components:

- **`/` (root)** — Next.js 16 frontend + API routes, deployed to Vercel
- **`/worker`** — Cloudflare Worker (this directory), deployed via Wrangler

## This directory: Cloudflare Worker

The worker runs on a cron schedule (`0 */6 * * *` — every 6 hours) and also accepts HTTP requests with a `RUN_SECRET` header for manual triggering.

### Commands

```bash
# Run locally (requires wrangler login and secrets set)
npx wrangler dev

# Deploy
npx wrangler deploy

# Tail logs from production
npx wrangler tail

# Set a secret
npx wrangler secret put ANTHROPIC_API_KEY
```

### Configuration

`wrangler.toml` controls deployment vars. Secrets (API keys) must be set via `wrangler secret put` — they are not in `wrangler.toml`.

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CONGRESS_API_KEY`, `RUN_SECRET`.

Optional secrets: `RESEND_API_KEY` — required for digest email delivery to work.

### HTTP endpoints (all require `Authorization: Bearer RUN_SECRET`)

- `GET /health` — no auth, returns `{ ok: true }`
- `POST /run-now` — runs Congress bill ingestion
- `POST /run-external` — runs Federal Register + CourtListener ingestion
- `POST /run-digest` — runs digest delivery for all due users

## Root Next.js project

```bash
# From repo root
npm run dev       # Start dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint
```

**Note:** This project uses Next.js 16 with breaking changes from prior versions. Always read `node_modules/next/dist/docs/` before writing Next.js code — do not rely on training data for Next.js conventions.

### Environment variables (`.env.local`)

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`

## Architecture

### Data flow

1. **Worker** fetches bills from Congress.gov API + regulations/EOs from Federal Register + court decisions from CourtListener → calls Anthropic (claude-haiku-4-5) for AI analysis and audience tagging → upserts to Supabase → sends personalized digest emails via Resend to users who are due
2. **Next.js API routes** (`app/api/`) handle manual triggers for the same ingestion pipeline plus backfill operations
3. **Frontend** reads from Supabase, ranks content per user profile, renders dashboard and detail views

### Key data model

- `bills` — all content (bills, regulations, EOs, court decisions); distinguished by `content_type` column
  - `content_type`: `'bill'` | `'regulation'` | `'executive_order'` | `'court_decision'`
  - `sponsors`: JSONB array of `{ fullName, party, state, district }` (bills only)
  - `agency`: text, set for regulations/EOs/court decisions
- `bill_analysis` — AI-generated per-bill commentary (whyItMattersGeneral, broaderPattern, hotTake)
- `bill_audiences` — AI-generated audience segments per bill with rationale and confidence scores
- `profile_audiences` — derived audience labels per user email (from their interests/contexts/demographics)
- `goose_profiles` — user profiles including `digest_enabled`, `digest_frequency`, `last_digest_sent_at`

Schema lives in `supabase/*.sql`. Run pending migrations in order:
1. `schema.sql` — base schema
2. `add_demographics.sql` — income, education, race, location, employment, family columns
3. `add_content_and_sponsors.sql` — content_type, sponsors, agency on bills; last_digest_sent_at on goose_profiles
4. `add_authenticated_policies.sql` — RLS for authenticated role (required after enabling Supabase Auth)

### Audience matching pipeline

User preferences → `lib/audience-matching.ts:deriveProfileAudiences()` → stored as `profile_audiences` → matched against `bill_audiences` via label/key overlap scoring in `lib/audience-matching.ts:scoreAudienceMatch()`.

### Ranking

- Dashboard: `lib/dashboard-ranking.ts:rankBillsForDashboard()` — scores bills against profile audiences + topic/context overlap
- Digest email (Next.js): `lib/digest-ranking.ts:buildRankedDigestBills()` — similar logic, returns top N with analysis
- Digest email (worker): simple keyword scoring inline in `worker/src/index.ts:scoreAndRankBillsForUser()`

### AI usage

All AI calls use the Anthropic SDK with `tool_choice: { type: "tool" }` to force structured JSON output — no freeform text parsing. Model is `claude-haiku-4-5` throughout. The tool-calling pattern is in `lib/ingestion.ts` (Next.js) and duplicated in `worker/src/index.ts:anthropicToolCall()` (worker uses raw fetch, not the SDK).

### Supabase access

- **Next.js**: All reads/writes go through typed store modules in `lib/supabase/` (e.g. `bills-store.ts`, `bill-analysis-store.ts`). The client is a singleton at `lib/supabase/client.ts`.
- **Worker**: Uses raw `fetch()` against the Supabase REST API (`/rest/v1/...`) with service role key — no SDK available in Cloudflare Workers.

### External data sources

| Source | Content types | Notes |
|--------|--------------|-------|
| Congress.gov API | `bill` | Requires `CONGRESS_API_KEY` secret |
| Federal Register API | `regulation`, `executive_order` | Public, no auth needed |
| CourtListener API | `court_decision` | Public, no auth needed |

Next.js API routes for manual ingestion: `POST /api/ingest-regulation`, `POST /api/ingest-executive-order`, `POST /api/ingest-court-decision`. Each accepts `{ limit: number }` body. The shared fetch logic lives in `lib/external-sources.ts`.

### Digest delivery

Worker-side digest delivery (`runDigestDelivery`):
1. Fetch users with `digest_enabled = true` from `goose_profiles`
2. For each user, check if due based on `digest_frequency` vs `last_digest_sent_at`
3. Score and rank bills by topic/interest keyword overlap
4. Build HTML email and POST to Resend API (`https://api.resend.com/emails`)
5. Update `last_digest_sent_at` on the profile

Frequency thresholds: Daily = 23h, Twice a week = 3.5d, Weekly = 6.5d, Monthly = 28d.

## Auth model

Uses **Supabase Auth** (email + password) via `supabase.auth` from `@supabase/supabase-js`. No custom password hashing — Supabase handles it server-side.

### How it works

- **Sign-up / Login** — `app/preferences/page.tsx` has a three-step flow:
  1. `email-check`: user enters email → `getGooseProfileByEmail()` checks `goose_profiles`
  2. `login` (existing account): email + password → `supabase.auth.signInWithPassword()`
  3. `setup` (new account): email + password only → `supabase.auth.signUp()` → redirects to `/onboarding`
- **Onboarding** — `app/onboarding/page.tsx` is an interactive chat with Harnold (Claude AI via `POST /api/onboarding`). When done, saves all profile fields to localStorage and redirects to dashboard.
- **Logout** — dashboard "Log out" button calls `supabase.auth.signOut()`, clears localStorage, redirects to `/`
- **Session** — Supabase Auth manages the JWT session automatically. Profile data is mirrored to localStorage keys: `userEmail`, `userInterests`, `userContexts`, `userAge`, `userGender`, `userIncome`, `userEducation`, `userRace`, `userLocation`, `userEmployment`, `userFamily`

### Supabase setup required

- In Supabase Dashboard → Authentication → Providers: ensure **Email** is enabled
- For development, disable **"Enable email confirmations"** (Authentication → Settings) so signUp redirects immediately without a confirmation step
- Schema notes: `goose_profiles.email` is the primary key and join key to `auth.users.email`
- `supabase/add_password_auth.sql` contains optional RLS policies to lock each profile to its owner
- `supabase/add_authenticated_policies.sql` **must be run** — adds permissive policies for the `authenticated` role on all tables. Without it, logged-in users get empty results (RLS blocks `authenticated` role by default).

### What this means for development

- **No duplicate accounts** — email-check routes existing users to login; new-account form only shown for unknown emails; `goose_profiles` uses upsert on conflict
- **No middleware** — routes are not server-protected; the dashboard degrades gracefully when no session exists
- **RLS covers both roles** — policies must exist for both `anon` and `authenticated` roles; the `add_authenticated_policies.sql` migration handles this

## React patterns — known pitfalls

**Never define a function inside a component that returns JSX and call it inline.** React treats each call as a new element type, unmounting and remounting on every render (inputs lose focus on each keystroke). Always inline JSX directly or extract as a named component defined outside the parent component.

```tsx
// BAD — causes remounting
function MyComponent() {
  function renderInput() { return <input ... /> }
  return <div>{renderInput()}</div>
}

// GOOD — inline or named component outside
function MyComponent() {
  return <div><input ... /></div>
}
```

**`useSearchParams()` requires a Suspense boundary** in Next.js 16 when the page can be statically rendered. Wrap the component that calls `useSearchParams` in `<Suspense>` from the default export.
