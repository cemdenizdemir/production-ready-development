---
title: Optimistic UI, offline, and destructive actions
tech: React 19.2, TanStack Query 5
version: React 19.2, TanStack Query v5
date: 2026-11-09
covers: [5, 7, 9]
---
# Optimistic UI, offline, and destructive actions
[← Overview](00-overview.md)

## Why it matters
- "Are you sure?" dialogs on every remove action train users to click "Yes" without reading; they delete the wrong address anyway.
- A user on a train taps "Save note"; the request fails silently while offline and the note is gone.
- A double tap on "Pay" sends two payment requests.

## Concepts

### Optimistic UI and undo
Show the expected result immediately; reconcile with the server.
| Use optimistic UI | Don't |
|:--|:--|
| toggles, favorites, quantity changes, notes, reordering | payments, orders, stock reservations, anything often rejected |
| changes that are easy to roll back | changes with side effects for others (emails sent) |

Undo instead of confirm for reversible actions: perform (or optimistically hide) the action, show "Removed Ethiopia Guji. **Undo**" for ~6 s; commit if not undone. Undo can be implemented as a delayed request, or as an API-supported restore (soft delete) for longer windows.

### Destructive actions
| Risk | Pattern |
|:--|:--|
| reversible (remove from cart, archive) | ⭐ undo |
| irreversible and important (delete account, cancel subscription) | confirmation dialog that names the thing and the consequence; for very destructive actions, type the name |
| double submit | disable while pending, idempotency key, React Actions pending state |
| accidental navigation away | warn on unsaved changes (`beforeunload` sparingly) |

A good confirm: title "Delete address 'Home'?", text with the consequence, buttons "Delete address" / "Keep address" (not "OK/Cancel"), focus on the safe option.

### Offline and slow networks
| Situation | Behavior |
|:--|:--|
| read while offline | show cached data with "You're offline. Showing saved data." |
| write while offline | queue it (TanStack Query pauses mutations with `networkMode: "online"` and resumes on reconnect) or block with a clear message for critical writes |
| slow responses | after ~1 s, show progress; after ~10 s, offer to retry/cancel |
| reconnect | refetch stale queries automatically (`refetchOnReconnect`), announce "Back online" |
| timeouts | `AbortSignal.timeout` on requests, retry with backoff for idempotent reads |

`onlineManager` (TanStack Query) and `navigator.onLine` + `online`/`offline` events tell you the browser's view; a successful request is the real test. Paused mutations can be persisted (`persistQueryClient`) for apps that must survive reloads offline; most shops don't need that.

## Example
`web/src/features/cart/useRemoveWithUndo.ts`
```ts
"use client";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCartQueryKey, useRemoveCartLine } from "@/api/generated/cart/cart";
import type { CartDto } from "@/api/generated/model";
import { toast } from "@/components/ui/toast";

export function useRemoveWithUndo() {
  const qc = useQueryClient();
  const remove = useRemoveCartLine();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  return (sku: string, name: string) => {
    const key = getGetCartQueryKey();
    const previous = qc.getQueryData<CartDto>(key);
    qc.setQueryData<CartDto>(key, (c) => c && { ...c, lines: c.lines.filter((l) => l.sku !== sku) });   // hide now

    const t = setTimeout(() => {
      timers.current.delete(sku);
      remove.mutate({ sku }, {
        onError: () => { qc.setQueryData(key, previous); toast.error(`Couldn't remove ${name}.`); },
        onSettled: () => qc.invalidateQueries({ queryKey: key }),
      });
    }, 6000);
    timers.current.set(sku, t);

    toast.info(`Removed ${name}.`, {
      action: { label: "Undo", onClick: () => { clearTimeout(timers.current.get(sku)); qc.setQueryData(key, previous); } },
      durationMs: 6000,
    });
  };
}
```
`web/src/components/ui/OfflineBanner.tsx`
```tsx
"use client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";   // useSyncExternalStore (04-framework)

export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" aria-live="polite">
      {!online && <p className="fixed inset-x-0 bottom-0 bg-stone-900 p-3 text-white">You're offline. Changes will be sent when you're back online.</p>}
    </div>
  );
}
```

## Production patterns
- Undo for reversible actions, confirmation dialogs only for irreversible ones, with specific wording.
- Every write has pending state, double-submit protection, and (for creates) an idempotency key the ASP.NET Core API honors.
- Offline: keep reads useful with cached data; be explicit about whether writes are queued or blocked.
- Toasts with actions stay long enough and are keyboard reachable; announcements go through the live region.

## Mistakes
Wrong: `confirm("Are you sure?")` on every delete.
Right: undo for reversible actions; a specific confirm dialog for irreversible ones.

Wrong: optimistic payment success.
Right: wait for the API; show progress; never pretend money moved.

## Check yourself
1. When is undo better than a confirmation dialog?
2. What happens to TanStack Query mutations triggered while offline (default network mode)?
3. What three things prevent double submits end to end?

<details><summary>Answers</summary>

1. When the action is reversible: it doesn't interrupt the flow, and users can recover from mistakes they didn't notice.
2. They're paused and run when the connection returns.
3. Disabling the control while pending (UI), an idempotency key per submission (protocol), and the API deduplicating by that key (server).
</details>

## Sources
- [NN/g — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/)
- [TanStack Query — Optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query — Network mode / offline](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [web.dev — Offline UX design guidelines](https://web.dev/articles/offline-ux-design-guidelines)
