---
title: Optimistic UI, offline, and destructive actions
tech: React 19.2, TanStack Query 5, Tailwind CSS 4
version: React 19.2, TanStack Query v5
date: 2026-11-07
covers: [5, 7, 9]
---
# Optimistic UI, offline, and destructive actions
[← Overview](00-overview.md)

## Why it matters
- Every delete asks "Are you sure?". Users click "Yes" by reflex, then accidentally delete the wrong project anyway.
- On a train, the app shows an infinite spinner instead of the data it already had cached ten minutes ago.
- A slow "Pay" request makes users click again; two payments go through.

## Concepts

### Undo beats confirm (for reversible actions)
| Action | Pattern |
|:--|:--|
| Reversible, frequent (archive, delete a comment, remove from cart) | do it immediately + "Undo" toast for ~5–10 s |
| Irreversible, high impact (delete workspace, cancel subscription, refund) | confirmation dialog that names the object; for very destructive actions, type the name to confirm |
| Money movement | no optimistic success; pending state until the server confirms |

Undo can be implemented two ways:
- **Delayed commit:** hide the item now, send the request after the undo window. Simple, but the action is lost if the tab closes.
- **Soft delete:** send the request now (sets `deleted_at`), undo calls a restore endpoint. Robust; needs API support.

### Offline and slow networks
| Situation | UI |
|:--|:--|
| Offline, data cached | show cached data + "You're offline. Showing data from 10:42." |
| Offline, nothing cached | explain; offer to retry when back online |
| Mutation while offline | TanStack Query pauses it and resumes on reconnect; show "Will sync when you're back online" |
| Back online | refetch stale data automatically (default), clear the banner |
| Slow request | loader after a delay; after ~10 s, say it's still working; offer cancel/retry |
| Stale data | "Last updated 5 min ago" from `dataUpdatedAt` |

TanStack Query's default `networkMode: 'online'` pauses queries and mutations while offline (`fetchStatus: 'paused'`) and continues when the connection returns.

### Preventing double submits
| Layer | Technique |
|:--|:--|
| UI | disable the button while pending; show progress in the button |
| Client logic | ignore repeated calls while a mutation is pending |
| API | `Idempotency-Key` header so retries are safe ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)) |
| Data | unique constraints for things that must exist once |

## Example
`useArchiveProject.ts` — immediate action with undo (soft delete on the server).
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';

type Project = { id: string; name: string };
const key = ['projects'] as const;

export function useArchiveProject() {
  const qc = useQueryClient();

  const restore = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}/restore`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return useMutation({
    mutationFn: (project: Project) => api(`/projects/${project.id}/archive`, { method: 'POST' }),
    onMutate: async (project) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Project[]>(key);
      qc.setQueryData<Project[]>(key, (old = []) => old.filter((p) => p.id !== project.id));
      return { previous };
    },
    onSuccess: (_data, project) => {
      toast.success(`Archived “${project.name}”`, {
        action: { label: 'Undo', onClick: () => restore.mutate(project.id) },
        duration: 8_000,
      });
    },
    onError: (_err, project, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(`Couldn't archive “${project.name}”. Try again.`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```
`OfflineBanner.tsx` — honest state when the network is gone.
```tsx
import { useMutationState } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus.ts'; // from 04-framework lesson 02

export function OfflineBanner() {
  const online = useOnlineStatus();
  const paused = useMutationState({ filters: { status: 'pending' }, select: (m) => m.state.isPaused });
  const pendingSync = paused.filter(Boolean).length;

  if (online && pendingSync === 0) return null;
  return (
    <div role="status" className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
      {online
        ? `Syncing ${pendingSync} change${pendingSync === 1 ? '' : 's'}…`
        : `You're offline. ${pendingSync ? `${pendingSync} change(s) will sync when you're back online.` : 'Showing saved data.'}`}
    </div>
  );
}
```
Stale-data hint:
```tsx
const { data, dataUpdatedAt, isError } = useQuery(ordersQuery(filters));
const minutes = Math.round((Date.now() - dataUpdatedAt) / 60_000);
{isError && data && <p className="text-sm text-gray-600">Couldn't refresh. Last updated {minutes} min ago.</p>}
```
A destructive confirmation that names the object:
```tsx
<dialog ref={dialogRef} aria-labelledby="delete-title">
  <h2 id="delete-title">Delete workspace “{workspace.name}”?</h2>
  <p>All projects and files are permanently deleted. This cannot be undone.</p>
  <form method="dialog" onSubmit={(e) => { if (confirmText !== workspace.name) e.preventDefault(); }}>
    <label>Type <strong>{workspace.name}</strong> to confirm
      <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
    </label>
    <button value="cancel" autoFocus>Cancel</button>
    <button value="delete" disabled={confirmText !== workspace.name} className="bg-red-600 text-white">Delete workspace</button>
  </form>
</dialog>
```

## Production patterns
- **Undo for reversible actions, confirmation only for irreversible ones**, and never optimistic success for payments.
- **Soft delete + restore endpoint** on the API for anything users might regret.
- **Cached data beats spinners offline**: show it with a timestamp and a clear banner.
- **Pending mutations are visible** (sync indicator) and resume after reconnect.
- **Double-submit protection in three layers**: disabled button, idempotency key, unique constraints.

## Mistakes
Wrong: "Are you sure?" for every small action. Right: do it, offer undo.

Wrong: a generic confirm that doesn't name the object.
```tsx
confirm('Are you sure?');
```
Right: "Delete workspace “Acme Marketing”? This cannot be undone." with a specific button label ("Delete workspace", not "OK").

Wrong: infinite spinner while offline. Right: cached data + offline banner, or an explanation with retry.

Wrong: relying only on a disabled button to prevent duplicate payments. A slow network and a fast double-tap, a retry, or a second tab still duplicate it.
Right: idempotency keys on the API too.

## Check yourself
1. When is a confirmation dialog the right pattern, and when is undo better?
2. What happens to a TanStack Query mutation started while offline (default settings)?
3. Name the three layers that prevent duplicate submissions.

<details>
<summary>Answers</summary>

1. Confirmation for irreversible, high-impact actions (deleting a workspace, money movement). Undo for frequent, reversible actions, where confirmations train people to click "Yes" without reading.
2. It's paused (`isPaused` true) and runs automatically when the connection returns; the UI can show it as pending sync.
3. The UI (disable while pending), the API (idempotency keys make retries safe), and the database (unique constraints for things that must exist once).
</details>

## Sources
- [Nielsen Norman Group — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/)
- [TanStack Query — Network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [TanStack Query — `useMutationState`](https://tanstack.com/query/latest/docs/framework/react/reference/useMutationState)
- [web.dev — Offline UX design guidelines](https://web.dev/articles/offline-ux-design-guidelines)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
