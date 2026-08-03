# AlgoSRS

[![CI](https://github.com/omarzayedbeshir/lc-fsrs/actions/workflows/ci.yml/badge.svg)](https://github.com/omarzayedbeshir/lc-fsrs/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-AlgoSRS-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/algosrs/plpjamlaminnemffpjingliljjmhahlk)
[![Go 1.22](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)](https://go.dev)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Chrome extension that uses the [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) spaced-repetition algorithm — the same scheduler powering Anki — to help LeetCode users systematically review and retain problem-solving skills. Save problems with a rating, review on an FSRS-optimized schedule, and sync across devices.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/algosrs/plpjamlaminnemffpjingliljjmhahlk)

## Demo

<p align="center">
  <img src="screenshots/demo.gif" alt="AlgoSRS Demo">
</p>

**Stack**: WXT / React 18 / Go 1.22 + stdlib / PostgreSQL (pgx v5) / Supabase Auth / ts-fsrs v5 / Railway

## Features

- **FSRS-optimized review scheduling** — rate each problem on a 1–4 scale (Again / Hard / Good / Easy) and get a personalized, Anki-style review schedule computed client-side via ts-fsrs v5.
- **Auto-captured problem data** — the widget reads the current problem's title, difficulty, and tags straight off the LeetCode page, so saving takes one tap.
- **Review session mode** — knock out everything due in one full-screen queue with keyboard shortcuts (1–4 to rate, `S` to skip, `Enter` to submit). Sessions are resumable, and skip/review counts are tracked.
- **Daily review limit** — cap how many reviews you tackle per day (default 5, up to ∞). Overflow lands in a per-day "Delayed" section and rolls over.
- **Practice list** — every saved problem grouped into **Due Now**, **Delayed**, and **Upcoming** sections.
- **Profile & statistics** — a 2×2 stat grid (problems, avg rating, stability, reviews) with rating-distribution bars, plus a dashboard of SVG charts for difficulty, rating distribution, top topics, and stability — including your current streak.
- **Dark mode** — the widget follows LeetCode's theme and your system preference automatically.
- **Data controls** — export everything as JSON, toggle marketing consent, reset all data, or permanently delete your account with a two-step confirmation.
- **Local-first with sync** — instant UI from `chrome.storage.local`, background delta sync every 30 minutes, and a merge flow when you sign in with existing cloud data.
- **Supabase Auth** — email/password sign-in (PKCE) with an inline password-reset page served by the backend.

## Architecture

```
Extension (Popup + Content Script + Background)
    │                          │
    │ JWT (api calls)          │ PKCE (auth)
    ▼                          ▼
Go Backend (Railway)      Supabase Auth
    │
    │ pgx pool
    ▼
PostgreSQL
```

Data flows local-first: entries are written to `chrome.storage.local` immediately for instant UI, then synced to the backend. Review scheduling is computed client-side via `ts-fsrs`. Background sync uses delta sync (dirty entries + pending deletes + `last_sync_at` cursor) with newer-`updated_at`-wins conflict resolution and FSRS state preservation. Server processes upserts and deletes in a single batch round trip.

## Key Engineering Decisions

**Local-first with server sync.** All CRUD reads from `chrome.storage.local` — no loading spinners. Save and Review panels additionally `POST /api/entries` immediately for durability. Background sync merges on URL identity with newer-`date`-wins conflict resolution. Offline-capable by design.

**Why Go for the backend.** Two external dependencies (`pgx`, `golang-jwt`). Single binary, ~200ms cold start on Railway's free tier. Go 1.22 `http.ServeMux` supports method-based routing (`mux.Handle("POST /api/entries", ...)`) natively — no framework needed for 9 routes. In-memory rate limiter, CORS allowlist, and input validation are all stdlib. JWKS caching with background refresh every 5 minutes (10-minute TTL) for Supabase token verification.

**Supabase Auth in a Chrome extension.** Standard PKCE assumes a web app that can receive OAuth redirects. In an extension, we provide a custom `SupportedStorage` adapter backed by `chrome.storage.local` so the session persists across popup lifetimes. Password reset uses the implicit flow (`POST /auth/v1/recover` directly from the extension); our Go backend serves a client-side JS page at `/auth/callback` that reads `#access_token=xxx&type=recovery` from the URL hash and renders an inline reset form.

**Security-first middleware stack.** CORS uses an allowlist (extension origin, LeetCode domains, Railway domain) instead of `*`. In-memory per-user rate limiting (60 req/min for entries, 10/min for sync) with `Retry-After` headers, keyed by user after auth. Input validation rejects malformed entries (title length, URL format, enum values). Request bodies capped at 1 MB. JWT validation uses JWKS only — no HMAC fallback. JWKS cache refreshes in the background every 5 minutes with stale-while-revalidate on error.

**Two-step account deletion.** Deleting your account is a two-request flow: `POST /api/user/delete-request` records intent, then `DELETE /api/user?confirm=true` finalizes it. Delete requests expire after 24 hours (configurable via `DELETE_CONFIRMATION_TTL_HOURS`).

**Delta sync with deletion tracking.** Background sync sends only dirty entries (tracked via a `needsSync` flag) and a pending-deletes queue instead of the full dataset. The server returns only entries changed since the last sync cursor (`last_sync_at`). All upserts and deletes in a sync request are batched into a single `pgx.Batch` round trip instead of N individual queries.

## Project Structure

```
src/
├── entrypoints/          # background.ts (auth message handler, 30-min periodic sync)
│   │                     # content.tsx (widget injected on leetcode.com/problems/*)
│   └── popup/            # App.tsx + main.tsx + style.css
├── components/           # AuthPanel, PracticeList, ProfilePanel, RatingButtons,
│                         # ReviewSession, SavePanel, SettingsPanel, StatsPanel,
│                         # SyncStatus, ThemeContext, WidgetApp
├── lib/                  # api-client, fsrs (scheduler wrapper), leetcode (DOM extraction),
│                         # queue (review queue + daily limit), streak, supabase,
│                         # sync (delta sync)
├── storage.ts            # chrome.storage.local persistence + review session state
├── styles.ts             # theme-aware color palettes and shared styles
└── types.ts              # shared TypeScript types
backend/
├── main.go               # HTTP router (9 endpoints)
├── handler/
│   ├── entries.go        # All request handlers
│   ├── callback.html     # Embedded password reset page (go:embed)
│   └── errors.go         # JSON response helper
├── middleware/
│   ├── auth.go           # JWT verification (JWKS only)
│   ├── cors.go           # Origin allowlist
│   ├── jwks.go           # JWKS cache with background refresh
│   ├── ratelimit.go      # Per-user rate limiter
│   ├── validate.go       # Input validation
│   └── body.go           # Request size limit
├── db/postgres.go        # pgx connection pool
├── db/schema.sql         # DDL
└── models/entry.go       # Entry, SyncRequest, SyncResponse
```

## Getting Started

```bash
npm install && npx wxt prepare
cp .env.example .env && cp backend/.env.example backend/.env

# Start Postgres and run schema
docker compose up -d db

# Start the backend
cd backend && go run .        # Backend on :8080

# Start the extension dev server (in another terminal)
cd .. && npm run dev           # Chrome with extension loaded
```

## Testing

```bash
# Frontend unit tests, lint, formatting, and type checks
npm test
npm run lint
npm run format:check
npm run typecheck

# Backend tests (requires DATABASE_URL for integration tests)
cd backend && go test ./...

# Go linter (local only; CI runs go test + go build)
cd backend && golangci-lint run
```

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/auth/callback` | No | Password reset form page |
| `GET` | `/api/entries` | JWT | List entries |
| `POST` | `/api/entries` | JWT | Upsert entry |
| `DELETE` | `/api/entries` | JWT | Delete entry by `?id=` |
| `DELETE` | `/api/user/entries` | JWT | Delete all entries |
| `POST` | `/api/user/delete-request` | JWT | Request account deletion (TTL expiry) |
| `DELETE` | `/api/user` | JWT | Delete account + entries (`?confirm=true`) |
| `POST` | `/api/sync` | JWT | Delta sync (entries + `deleted_ids` + `last_sync_at`) |

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Required for account deletion |
| `ALLOWED_ORIGINS` | No | Built-in defaults | Comma-separated CORS origins |
| `RATE_LIMIT_ENTRIES` | No | `60` | Requests/min for entry endpoints |
| `RATE_LIMIT_SYNC` | No | `10` | Requests/min for sync endpoint |
| `DELETE_CONFIRMATION_TTL_HOURS` | No | `24` | Account delete-request expiry in hours |

### Extension (`.env`)
| Variable | Required | Description |
|---|---|---|
| `WXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `WXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `WXT_PUBLIC_BACKEND_URL` | No | Backend URL (default `http://localhost:8080`) |

## Deployment

```bash
railway up                    # Backend (Dockerfile-based)
npm run build                 # Extension → output/chrome-mv3/
npm run zip                   # Packaged .zip for the Chrome Web Store
```

## Chrome Web Store

[Install AlgoSRS](https://chromewebstore.google.com/detail/algosrs/plpjamlaminnemffpjingliljjmhahlk) — Spaced Repetition for LeetCode.

- **Short description:** Save LeetCode problems with FSRS ratings and review on an optimized schedule. Syncs across devices.
- **Category:** Education

## Privacy Policy

See [docs/index.md](docs/index.md) for the full privacy policy.
