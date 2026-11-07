---
title: UX States & Error Handling
module: 02-frontend
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
---
# UX States & Error Handling
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Every screen has states: loading, empty, error, partial, success, offline
- [ ] ⭐ Loading UX: skeletons vs spinners, avoiding flicker, `isPending` vs `isFetching`
- [ ] ⭐ Error handling in the UI: error boundaries, query errors, retries, helpful messages
- [ ] Empty states that help the user act
- [ ] Optimistic UI and undo instead of confirm dialogs
- [ ] Feedback: toasts, inline messages, and accessible status announcements
- [ ] Offline and slow networks: cached data, stale indicators, paused mutations
- [ ] Suspense-based loading with `useSuspenseQuery` and where to place boundaries
- [ ] Destructive actions: confirmations, undo, and preventing double submits
- [ ] Reporting UI errors with context (Sentry)

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Screen states, loading, empty states, and Suspense](docs/01-states-and-loading.md)
- [02 · Errors, feedback, and reporting](docs/02-errors-and-feedback.md)
- [03 · Optimistic UI, offline, and destructive actions](docs/03-optimistic-offline-destructive.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn 02-frontend/09-ux-states mode=tasks` when you are ready to build._
