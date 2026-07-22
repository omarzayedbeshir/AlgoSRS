# Contributing

## Prerequisites

- Node.js 20+
- Go 1.22+
- Docker (for local Postgres)

## Setup

```bash
# Clone and install
git clone https://github.com/<user>/algosrs
cd algosrs

# Frontend
npm install
npx wxt prepare
cp .env.example .env  # fill in Supabase credentials

# Backend
cp backend/.env.example backend/.env  # fill in credentials
docker compose up -d db                # start Postgres
cd backend && go run .                 # starts on :8080
```

## Running Locally

```bash
npm run dev    # WXT dev server (Chrome extension hot reload)
cd backend && go run .  # Go API server
```

## Testing

```bash
npm test                    # Vitest (frontend unit tests)
cd backend && go test ./...  # Go tests (unit + integration)
```

Integration tests require `DATABASE_URL` pointing to a running Postgres.

## Linting & Formatting

```bash
npm run lint         # ESLint
npm run format       # Prettier (auto-fix)
cd backend && golangci-lint run  # Go linter
```

## Pull Requests

1. Ensure all tests pass and lint is clean.
2. Keep changes focused — one feature or fix per PR.
3. Write clear commit messages (conventional commits preferred).
