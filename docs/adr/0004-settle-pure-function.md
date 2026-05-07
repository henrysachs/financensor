# ADR-0004: Settlement algorithm as pure function in internal/settle

## Status
Accepted

## Context
`minCashFlow` was a pure algorithm trapped inside `api/settlements.go`. The `internal/settle/` package existed but was empty (dead code from incomplete refactor).

## Decision
- Export `settle.MinCashFlow(balance map[string]int64) []Transfer`
- Handler fetches purchases via `PurchaseRepository.List`, computes balances, calls `MinCashFlow`
- No repository dependency in the settle package — it's pure computation

## Consequences
- Trivially testable with table-driven tests (no DB, no HTTP)
- Reusable if settlement logic is needed elsewhere (e.g., notifications)
- Clear separation: data fetching (handler) vs. algorithm (settle)
