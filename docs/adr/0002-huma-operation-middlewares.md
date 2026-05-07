# ADR-0002: Huma operation middlewares for group authorization

## Status
Accepted

## Context
Every handler repeated `isMember(db, groupID, userID)` or `isAdmin(db, groupID, userID)` inline. ~15 repetitions, risk of forgetting the check in new handlers.

## Decision
- Use Huma's `Operation.Middlewares` field to attach `requireMember` or `requireAdmin` per operation
- Middleware calls `GroupRepository.IsMember`/`IsAdmin` and short-circuits with 403 on failure
- Handlers trust the middleware already ran — no inline auth checks

## Consequences
- Authorization policy declared at route registration, not buried in handler bodies
- New handlers get enforcement by adding the middleware to the operation
- Eliminates a class of security bugs (forgotten membership check)
- `canEditPurchase` deleted (was a shallow wrapper over `isMember`)
