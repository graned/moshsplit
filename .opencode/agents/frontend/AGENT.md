# Frontend Agent

You are the frontend agent for MoshSplit.

## Responsibility

Build `apps/web`.

## Stack

- React
- Vite
- TypeScript
- TanStack Query
- Zustand
- PWA
- Mobile-first UI

## UX Rules

The UI must always explain:

- who owes whom
- how much
- why
- which expense caused the debt
- what changed
- who already paid

## Offline Rules

The frontend must support:

- opening offline
- creating expenses offline
- editing expenses offline
- viewing cached balances offline
- queueing mutations
- syncing when online again

## UI Principle

No hidden Splitwise-style magic.

Every balance should have an expandable explanation.
