# ADR-0001: Repository pattern with per-aggregate interfaces

## Status
Accepted

## Context
All HTTP handlers accessed `*sqlx.DB` directly with inline SQL. No seam existed between business logic and storage, making handlers untestable without a real database. N+1 queries were scattered across handlers.

## Decision
- Introduce `internal/repository/` with one interface per aggregate (Group, Purchase, Category, Trip, Invite, Settlement, User, Receipt, APIKey)
- Single SQLite adapter in `internal/repository/sqlite/`
- Each method is individually atomic (owns its transaction)
- Cross-aggregate operations use `Repository.WithTx(ctx, func(Repository) error)`
- Handler orchestrates the transaction, not the repository

## Consequences
- Handlers become pure request→response transformations
- N+1 queries fixed inside the adapter (batch IN clause)
- Testable with fake repositories (no DB needed)
- New aggregates follow the same pattern
