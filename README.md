# Financensor

Shared expense tracker for groups and trips. Split costs fairly, track who paid what, and settle up with minimal transfers.

**Live:** [financensor.stammkneipe.dev](https://financensor.stammkneipe.dev)

## Features

- Google OAuth login
- Create groups and invite members via link
- Track purchases with categories, assignments, and receipts
- Organize expenses into trips/activities
- Bulk and single-row inline editing
- Draft persistence (localStorage) with unsaved-change warnings
- Automatic settlement calculation (minimal transfers)
- Per-person consumption charts, spending over time, category breakdown
- API keys for programmatic access (receipt scanning, bulk import)
- Mobile-friendly UI

## Architecture

Monorepo with two packages:

| Layer | Stack |
|-------|-------|
| **Backend** | Go 1.26, chi router, SQLite (pure Go via modernc.org/sqlite), JWT auth |
| **Frontend** | React 19, Vite 8, TanStack Router (file-based), Tailwind CSS v4, shadcn/ui |

Production runs on a Hetzner VPS with Docker Compose and Traefik (auto-HTTPS):
- `financensor.stammkneipe.dev` — frontend SPA (nginx)
- `api.financensor.stammkneipe.dev` — backend REST API

## Getting Started

### Prerequisites

- Go 1.26+
- Node.js 22+
- [mise](https://mise.jdx.dev/) (optional, for task runner)

### Backend

```bash
cd backend
cp .env.example .env  # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
go run ./cmd/server
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Vite dev server on :5173, proxies /api to :8080
```

### Verify

```bash
cd backend && go build ./...
cd frontend && npx tsc -b && npx vite build
```

## Deploy

```bash
mise run deploy           # rsync + build on server
mise run release-deploy   # semantic-release + deploy tagged version
```

## Project Conventions

- German UI text
- Amounts stored as `int64` cents (`amount_cents`)
- UUIDs as TEXT primary keys
- REST API prefix: `/api/v1`
- Conventional commits, semantic versioning

## License

Private project. All rights reserved.
