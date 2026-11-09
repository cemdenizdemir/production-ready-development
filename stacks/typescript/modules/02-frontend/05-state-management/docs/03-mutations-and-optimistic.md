---
title: Mutations and optimistic updates
tech: React 19.2, TanStack Query 5
version: TanStack Query v5
date: 2026-11-07
covers: [3, 4]
---
# Mutations and optimistic updates
[← Overview](00-overview.md)

## Why it matters
- A user renames a project; the list still shows the old name until they refresh, because nothing told the cache the data changed.
- An optimistic "mark as done" fails on the server, but the UI keeps showing it done. The user trusts it and misses the task.
- Double-clicking "Pay" sends two POSTs because the button stays enabled while the request runs.

## Concepts

### Mutations
`useMutation({ mutationFn })` runs writes (POST, PUT, PATCH, DELETE) and tracks `isPending`, `isError`, `error`, `data`, and `variables`.

| Callback | When | Typical use |
|:--|:--|:--|
| `onMutate(variables)` | before the request | optimistic cache update; return rollback data |
| `onError(error, variables, context)` | on failure | roll back using `context` |
| `onSuccess(data, variables, context)` | on success | write the response into the cache |
| `onSettled(...)` | always | invalidate to resync with the server |

`mutate(vars)` fires and forgets (errors handled via callbacks); `mutateAsync(vars)` returns a promise you can await (wrap in try/catch).

### Updating the cache after a write
| Strategy | How | Use when |
|:--|:--|:--|
| Invalidate | `queryClient.invalidateQueries({ queryKey: orderKeys.lists() })` | simplest; refetches what changed |
| Write the response | `queryClient.setQueryData(orderKeys.detail(id), updated)` | the API returns the updated object |
| Both | set the detail, invalidate the lists | common |

Invalidation matches by **key prefix**: invalidating `['orders']` marks every orders query stale; active ones refetch.

### Optimistic updates, two ways
| Approach | How | Good for |
|:--|:--|:--|
| Via the UI | render `variables` while `isPending` | one place shows the pending item; simplest, no rollback code |
| Via the cache | `onMutate`: cancel queries, snapshot, `setQueryData`; `onError`: restore; `onSettled`: invalidate | the change must appear everywhere the data is shown |

Use optimistic updates for actions that almost always succeed and are easy to undo: toggles, likes, renames, reorders. Not for payments or anything with side effects users can't see reversed.

## Example
`useToggleTodo.ts` — optimistic update through the cache, with rollback.
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';

type Todo = { id: string; title: string; done: boolean };
const todosKey = ['todos'] as const;

export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (todo: Todo) =>
      api<Todo>(`/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !todo.done }),
      }),

    onMutate: async (todo) => {
      await queryClient.cancelQueries({ queryKey: todosKey });          // stop in-flight refetches overwriting us
      const previous = queryClient.getQueryData<Todo[]>(todosKey);       // snapshot for rollback
      queryClient.setQueryData<Todo[]>(todosKey, (old = []) =>
        old.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
      );
      return { previous };
    },

    onError: (_err, _todo, context) => {
      if (context?.previous) queryClient.setQueryData(todosKey, context.previous); // roll back
      toast.error('Could not update the task. Please try again.');
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: todosKey }), // resync with the server
  });
}
```
`AddTodo.tsx` — optimistic via the UI, using `variables`.
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function AddTodo() {
  const queryClient = useQueryClient();
  const addTodo = useMutation({
    mutationFn: (title: string) =>
      api<Todo>('/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  return (
    <>
      <form action={(fd) => addTodo.mutate(String(fd.get('title')))}>
        <input name="title" required aria-label="New task" />
        <button disabled={addTodo.isPending}>Add</button>   {/* no double submits */}
      </form>
      {addTodo.isPending && <li style={{ opacity: 0.5 }}>{addTodo.variables}</li>}
      {addTodo.isError && (
        <li role="alert">
          Failed to add “{addTodo.variables}”. <button onClick={() => addTodo.mutate(addTodo.variables!)}>Retry</button>
        </li>
      )}
    </>
  );
}
```
`toast` stands for your notification helper ([09-ux-states](../../09-ux-states/README.md)).

## Production patterns
- **Mutation hooks per action** (`useToggleTodo`, `useRenameProject`) next to the feature's query factory.
- **Always resync** in `onSettled` (invalidate), even after optimistic updates; the server is the source of truth.
- **Disable submit while pending** and send an `Idempotency-Key` for important POSTs ([03-backend/02-api-design](../../../03-backend/02-api-design/README.md)).
- **Show failures where the action happened**, with a retry; don't silently revert.
- **Use `useMutationState`** when another component needs to show pending mutations (for example a sync indicator).

## Mistakes
Wrong: mutating and forgetting the cache.
```ts
await api(`/projects/${id}`, { method: 'PATCH', body }); // list keeps the old name
```
Right: `invalidateQueries({ queryKey: projectKeys.lists() })` or `setQueryData` with the response.

Wrong: optimistic update without cancelling queries; an in-flight refetch overwrites the optimistic value with old data.
Right: `await queryClient.cancelQueries({ queryKey })` in `onMutate`.

Wrong: optimistic success for irreversible actions (charging a card). Right: show a pending state and wait for the server.

Wrong: mutating cached data in place.
```ts
queryClient.getQueryData<Todo[]>(['todos'])!.push(newTodo); // same reference: no re-render, corrupts cache
```
Right: `setQueryData` with a new array.

## Check yourself
1. Why call `cancelQueries` at the start of an optimistic update?
2. When is the "optimistic via `variables`" approach enough?
3. Why invalidate in `onSettled` even when you already updated the cache?

<details>
<summary>Answers</summary>

1. An in-flight refetch started before the mutation could return old data and overwrite the optimistic value.
2. When the pending item is shown in one place (the list where the user acted) and doesn't need to appear in other views of the same data.
3. The server may have changed more than you predicted (computed fields, other users' edits, ordering); invalidation brings the cache back in line with the truth.
</details>

## Sources
- [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [TanStack Query — Invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [TanStack Query — Optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query — `useMutationState`](https://tanstack.com/query/latest/docs/framework/react/reference/useMutationState)
