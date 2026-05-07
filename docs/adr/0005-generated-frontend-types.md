# ADR-0005: Generated frontend types from OpenAPI

## Status
Accepted

## Context
~100 lines of manually maintained TypeScript types in `api.ts` duplicated the backend's Huma-generated OpenAPI schema. Drift was silent — a backend field rename wouldn't cause a compile error.

## Decision
- Backend serves OpenAPI spec publicly at `/api/v1/openapi.json` (Huma built-in, auth skipped via `PublicPaths`)
- `openapi-typescript` generates `src/lib/api-types.gen.ts` with `--export-type --root-types`
- `api.ts` imports generated types and re-exports with clean domain names
- `npm run generate:api` regenerates from running server
- `.npmrc` with `legacy-peer-deps=true` for TS6 compat

## Consequences
- Backend schema changes propagate as compile errors
- Single source of truth for types (OpenAPI spec)
- Generated file is committed (no build-time server dependency)
- Two `Omit` wrappers needed: Go serializes empty slices as `null`, frontend normalizes to `[]`
