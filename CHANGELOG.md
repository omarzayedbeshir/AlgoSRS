# Changelog

## [0.1.0] - 2026-07-20

### Added
- FSRS-based spaced repetition scheduler (ts-fsrs v5) for LeetCode problem review
- Chrome extension widget injected on leetcode.com with frosted glass UI
- Rating panel: 1-4 scale (Again/Hard/Good/Easy) with FSRS scheduling
- Practice list showing due and upcoming reviews in iOS-settings style
- Profile panel with 2×2 stat grid, progress bars, reset data, delete account
- Statistics dashboard with SVG charts: difficulty breakdown, rating distribution, top topics, stability
- Chart carousel with slide animation and arrow navigation
- Authentication via Supabase Auth (PKCE) with chrome.storage.local adapter
- Merge flow when cloud data exists during sign-in
- Inline password reset page served by Go backend at `/auth/callback`
- Periodic background sync every 30 minutes
- Local-first architecture with last-write-wins conflict resolution
- Tags extracted from LeetCode "Topics" section
- Navigation monkeypatch to detect SPA route changes on LeetCode
- Escape key to minimize widget
- Sync status indicator (green dot)

### Backend
- Go 1.22 HTTP server with stdlib ServeMux (8 endpoints)
- PostgreSQL (pgx v5) with `leetcode_entries` table
- JWT Bearer token auth with JWKS caching (10-min TTL)
- CORS middleware
- Bulk sync endpoint with batch upsert + delete
- Account deletion proxied to Supabase Admin API
- Tags stored as `TEXT[]` column
- Health check endpoint at `/api/health`

### Infrastructure
- Dockerfile for multi-stage Go build (~15MB binary)
- Railway deployment config with health check
- Extension builds for Chrome MV3 and Firefox MV2 via WXT

## [0.0.1] - 2026-07-16
- Initial prototype: local-only React UI for storing LeetCode problem ratings
- Simple Go backend with Supabase Postgres
