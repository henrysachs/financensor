# ADR-0007: Public OpenAPI spec via auth.PublicPaths

## Status
Accepted

## Context
Huma auto-serves `/openapi.json`, `/docs`, `/schemas/*` but these were behind the auth middleware. Needed a way to make specific paths public without restructuring chi routing.

## Decision
- `auth.PublicPaths` struct with `Exact []string` and `Prefixes []string`
- `AuthMiddlewareSkipping(repo, PublicPaths{...})` skips auth for matching paths
- Applied at the `/api/v1` route group level
- Huma's built-in routes serve the spec — no custom handler needed

## Consequences
- Adding a new public endpoint = adding a string to the config
- No middleware restructuring needed for future public routes
- Exact vs prefix matching prevents accidental over-matching
- Per-version spec: `/api/v1/openapi.json` (v2 would get its own)
