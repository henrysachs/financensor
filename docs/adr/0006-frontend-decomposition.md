# ADR-0006: Frontend god-file decomposition with custom hooks

## Status
Accepted

## Context
`groups.$groupId.tsx` was 1274 lines with 10+ components and 20+ useState hooks in a single function. Untestable, hard to navigate, high risk of unintended side effects when modifying one tab.

## Decision
- Route file becomes thin orchestrator (~110 lines): layout, tabs, data passing
- Extract per-tab views: `TripsView`, `PurchasesView`, `SettlementsView`
- Extract presentational components: `TabButton`, `Avatar`, `TripCard`, `PurchaseRow`
- Extract chart components: `SpendingOverTimeChart`, `NetBalanceChart`, `CategoryChart`
- Decompose `PurchasesView` state into custom hooks: `useBulkEdit`, `useBulkActions`, `usePurchaseFilters`
- Extract `formatCents` to `lib/format.ts`

## Consequences
- Each component/hook is independently testable
- Bug in settlement display doesn't require reading purchase edit logic
- Charts reusable on other pages (e.g., dashboard)
- Navigation blocking and draft persistence logic isolated in `useBulkEdit`
