# LC FSRS

A Chrome extension that uses the [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) spaced-repetition algorithm — the same scheduler powering Anki — to help LeetCode users systematically review and retain problem-solving skills. Save problems with a difficulty rating, review them on a schedule optimized by FSRS, and sync across devices.

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Extension framework | [WXT](https://wxt.dev) | Vite-powered, Manifest V3 native, fast dev iteration |
| Frontend UI | React 18 | Declarative components, broad ecosystem support |
| Spaced repetition | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) v5 | Official TypeScript port of the Anki FSRS algorithm |
| Authentication | Supabase Auth (PKCE) | Managed auth service with session persistence via `chrome.storage.local` adapter |
| Backend | Go 1.22 + `net/http` | Single-binary deploy, fast Railway cold starts, stdlib routing (Go 1.22 patterns) |
| Database | PostgreSQL + pgx v5 | Reliable, well-supported on Railway, high-performant driver |
| Deployment | Railway (Docker) | Zero-config deploys, managed Postgres, auto-HTTPS |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│                                                              │
│  ┌─────────┐    ┌───────────┐    ┌───────────────────────┐  │
│  │ Popup   │    │  Content  │    │   Background Script   │  │
│  │ (React) │    │  Script   │    │                       │  │
│  │         │    │  (React)  │    │  Auth message handler │  │
│  │ Save/   │    │  Widget   │    │  Periodic sync (30m)  │  │
│  │ Review/ │    │  Overlay  │    │                       │  │
│  │ Browse  │    │           │    │                       │  │
│  └────┬────┘    └────┬──────┘    └──────────┬────────────┘  │
│       │              │                      │               │
│       └──────┬───────┘                      │               │
│              │                              │               │
│       ┌──────┴─────────┐                   │               │
│       │  chrome.storage                    │               │
│       │  .local (cache) │                   │               │
│       └──────┬─────────┘                   │               │
│              │                              │               │
└──────────────┼──────────────────────────────┼───────────────┘
               │                              │
               │  HTTPS (JWT Bearer)          │  PKCE
               ▼                              ▼
     ┌──────────────────┐          ┌──────────────────────┐
     │  Go Backend      │          │  Supabase Auth       │
     │  (Railway)       │          │  (gotrue)            │
     │                  │          │                      │
     │  POST /api/      │          │  signup / login /    │
     │  entries         │          │  logout / session    │
     │  POST /api/sync  │          │                      │
     │  DELETE /api/    │          │  Password reset      │
     │  user            │          │  callback page       │
     │                  │          └──────────────────────┘
     │  JWT validation  │
     │  (JWKS + HMAC)   │
     └────────┬─────────┘
              │
              │  pgx pool
              ▼
     ┌──────────────────┐
     │  PostgreSQL      │
     │  (Railway)       │
     │                  │
     │  leetcode_entries│
     └──────────────────┘
```

### Data Flow

1. **Save**: Popup/content script writes entry to `chrome.storage.local` immediately, then `POST /api/entries` to backend. UI is instant — no network wait.
2. **Review**: Same as save — FSRS calculates next due date locally via `ts-fsrs`, entry persisted immediately.
3. **Sync**: Background script runs every 30 minutes. Sends all local entries to `POST /api/sync`. Backend upserts each entry keyed by `(user_id, url)` and returns the full remote set. Merge uses URL as identity; newer `date` wins.
4. **Auth**: Supabase PKCE flow with a custom `SupportedStorage` adapter backed by `chrome.storage.local`. Password reset uses implicit flow (`POST /auth/v1/recover` directly from extension).

## Features

- **Save problems** with a difficulty rating — 😰😅🙂😎
- **FSRS-based spaced repetition** — algorithm schedules optimal review intervals based on your rating history, tracking stability, difficulty, and retrievability per problem
- **Review queue** — Due / Upcoming / All views filtered by FSRS schedule
- **Stats** — total problems saved, rating distribution, average rating %, average stability
- **Content script widget** — floating overlay on LeetCode pages, auto-detects problem data, collapsible badge
- **Cross-device sync** — Go backend persists all entries, conflict resolution by timestamp
- **Account management** — password reset via email, total data reset, account deletion
- **Offline-capable** — full CRUD works against local storage; syncs when online

## Key Engineering Decisions

### Local-First with Server Sync

All entries are written to `chrome.storage.local` first. The UI reads from local storage exclusively — no loading spinners for network requests. A background script syncs to the server every 30 minutes and on auth state changes. Save and Review panels additionally call `upsertEntry` immediately so data is never lost on browser close.

**Trade-off**: Conflict resolution is last-writer-wins by `date` field. Suitable for a single-user extension; would need CRDT or vector clocks for collaborative use.

### Why Go for the Backend

The backend is a single Go binary with two external dependencies (`pgx v5` for PostgreSQL, `golang-jwt` for token verification). Cold start on Railway's free tier is ~200ms vs several seconds for a Node.js or Python server. Go 1.22's `http.ServeMux` supports method-based routing (`mux.Handle("POST /api/entries", ...)`) natively — no framework needed for 8 routes.

### FSRS (Free Spaced Repetition Scheduler)

The [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) replaced Anki's legacy SM-2 in 2023 after years of research. `ts-fsrs` v5 is the official TypeScript port. Key parameters:

- `request_retention: 0.9` — target 90% recall probability at due time
- `enable_fuzz: true` — adds jitter to intervals to avoid interference patterns
- `enable_short_term: false` — LeetCode problems don't benefit from within-session review

Each problem has FSRS state persisted: `stability`, `difficulty`, `reps`, `lapses`, `state` (learning/review/relearning). The `get_retrievability` function estimates current retention probability.

### Supabase Auth in a Chrome Extension

Chrome extensions can't receive OAuth redirects, so the standard PKCE flow needs adaptation:

1. **Session persistence**: Supabase's PKCE flow stores session tokens in memory/localStorage by default. In an extension, we provide a custom `SupportedStorage` adapter backed by `chrome.storage.local`, which persists across popup lifetimes.
2. **`detectSessionInUrl: false`**: Password reset uses the implicit flow (`POST /auth/v1/recover`), which redirects with `#access_token=xxx` in the URL hash. Our backend serves a client-side JS page at `/auth/callback` that reads this hash and renders an inline password reset form — no redirect back to the extension needed.

### Account Deletion Proxy

Supabase's `DELETE /auth/v1/user` returns 405 when called from an unauthenticated context. The `service_role` key (required by the Admin API) must not be exposed in the extension. Solution: a backend endpoint `DELETE /api/user` that:

1. Deletes all entries for the user (authenticated via JWT)
2. Calls Supabase Admin API `DELETE /auth/v1/admin/users/{id}` with `SUPABASE_SERVICE_ROLE_KEY`

This keeps the `service_role` key server-side only.

### Sync with Concurrency Guard

`src/lib/sync.ts` uses a module-level `_syncing` flag to prevent concurrent sync invocations. The background script calls `syncAll()` on a 30-minute interval and on page navigation. Individual save/review operations bypass the sync guard and hit the API directly to ensure immediate persistence.

## Project Structure

```
lc-fsrs/
├── .env                          # Frontend env vars
├── package.json                  # Node deps, WXT scripts
├── tsconfig.json                 # TypeScript config
├── wxt.config.ts                 # WXT extension config
├── Dockerfile                    # Multi-stage Go build
├── railway.json                  # Railway deploy config
│
├── src/
│   ├── types.ts                  # LeetCodeEntry, Rating, etc.
│   ├── storage.ts                # chrome.storage.local abstraction
│   ├── env.d.ts                  # ImportMetaEnv type augmentation
│   ├── lib/
│   │   ├── api-client.ts         # Go backend HTTP client (JWT Bearer)
│   │   ├── fsrs.ts               # FSRS scheduler wrapper
│   │   ├── supabase.ts           # Supabase client singleton
│   │   └── sync.ts               # Local↔remote sync orchestration
│   ├── components/
│   │   ├── AuthPanel.tsx         # Login/signup/reset-password + merge flow
│   │   ├── SavePanel.tsx         # Rate-a-problem UI
│   │   ├── ReviewPanel.tsx       # FSRS grading UI
│   │   ├── PracticeList.tsx      # Due/upcoming queue
│   │   ├── SavedList.tsx         # Chronological saved list
│   │   ├── ProfilePanel.tsx      # Stats, reset, delete account
│   │   ├── SyncStatus.tsx        # Sync indicator dot
│   │   └── WidgetApp.tsx         # Content script overlay
│   └── entrypoints/
│       ├── background.ts         # Auth message handler, periodic sync
│       ├── content.tsx           # Injected on leetcode.com
│       └── popup/
│           ├── App.tsx           # Popup view router
│           ├── main.tsx          # React mount
│           ├── index.html        # Popup shell
│           └── style.css         # Popup styles
│
├── backend/
│   ├── main.go                   # HTTP router, entry point
│   ├── go.mod / go.sum
│   ├── .env.example
│   ├── db/
│   │   └── postgres.go           # pgx connection pool
│   ├── handler/
│   │   └── entries.go            # All HTTP handlers + callback page
│   ├── middleware/
│   │   ├── auth.go               # JWT validation
│   │   ├── cors.go               # CORS headers
│   │   └── jwks.go               # JWKS key fetching & caching
│   ├── migrations/
│   │   └── 001_create_entries.sql
│   └── models/
│       └── entry.go              # Entry, SyncRequest, SyncResponse
│
├── .wxt/                         # WXT auto-generated types
└── output/                       # Build artifacts (chrome-mv3/)
```

## Environment Variables

### Root `.env` (frontend)

```
WXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
WXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
WXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

### `backend/.env`

```
DATABASE_URL=postgresql://user:pass@host:6543/postgres
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-dashboard>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Getting Started

### Prerequisites

- Node.js 18+ / npm
- Go 1.22+
- A [Supabase](https://supabase.com) project (free tier)
- A PostgreSQL database (Supabase or local)

### Setup

```bash
# 1. Clone and install frontend deps
npm install
npx wxt prepare

# 2. Copy and fill environment files
cp .env.example .env
cp backend/.env.example backend/.env

# 3. Run database migration — connect to your Postgres instance and run:
#    backend/migrations/001_create_entries.sql

# 4. Start the backend
cd backend && go run .

# 5. Start the extension (opens Chrome with dev loading)
cd .. && npm run dev
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS leetcode_entries (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES auth.users(id),
    title           TEXT        NOT NULL,
    url             TEXT        NOT NULL,
    difficulty      TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    rating          SMALLINT    NOT NULL CHECK (rating >= 1 AND rating <= 4),
    date            TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stability       DOUBLE PRECISION DEFAULT 0,
    difficulty_fsrs DOUBLE PRECISION DEFAULT 0,
    due_date        TIMESTAMPTZ,
    reps            INTEGER     DEFAULT 0,
    lapses          INTEGER     DEFAULT 0,
    fsrs_state      INTEGER     DEFAULT 0,
    last_review_at  TIMESTAMPTZ,
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id    ON leetcode_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON leetcode_entries(updated_at);
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/auth/callback` | No | Password reset form page |
| `GET` | `/api/entries` | JWT | List all entries for user |
| `POST` | `/api/entries` | JWT | Upsert a single entry |
| `DELETE` | `/api/entries` | JWT | Delete an entry by `?id=` |
| `DELETE` | `/api/user/entries` | JWT | Delete all entries for user |
| `DELETE` | `/api/user` | JWT | Delete account + all entries |
| `POST` | `/api/sync` | JWT | Bulk sync (upsert + delete + return) |

## Deployment

The backend is deployed on Railway. The `railway.json` config specifies Dockerfile-based builds with a healthcheck at `/api/health`.

```bash
# Deploy (requires Railway CLI + linked project)
railway up
```

The extension is built and loaded unpacked in Chrome:

```bash
npm run build
# Load output/chrome-mv3/ from chrome://extensions
```
