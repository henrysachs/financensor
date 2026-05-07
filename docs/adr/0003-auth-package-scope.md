# ADR-0003: Auth package scope — middleware + JWT only

## Status
Accepted

## Context
`internal/auth/auth.go` (343 lines) handled JWT, API keys, OAuth HTTP handlers, user upsert, middleware, and context helpers. Wide interface, low cohesion.

## Decision
- `internal/auth/` owns: JWT generation/parsing, API key hashing, `AuthMiddleware`, context helpers, `PublicPaths` config
- OAuth HTTP handlers (`HandleGoogleLogin`, `HandleGoogleCallback`) moved to `internal/api/oauth.go` — they're HTTP handlers, not auth infrastructure
- User upsert moved to `UserRepository` — it's a domain operation

## Consequences
- Auth module interface shrinks to "authenticate this request"
- OAuth flow changes don't risk breaking JWT validation
- `auth` has no dependency on `repository` for user creation (only for middleware token lookup)
