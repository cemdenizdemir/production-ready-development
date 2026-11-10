---
title: Mutations, cache updates, and optimistic updates
tech: TanStack Query 5, Orval, React 19.2
version: TanStack Query v5, Orval 8.x
date: 2026-11-09
covers: [3, 4]
---
# Mutations, cache updates, and optimistic updates
[← Overview](00-overview.md)

## Why it matters
- After "Cancel order" succeeds, the order list still says "Placed" until a reload; users click again and get a 409 from the API.
- An optimistic quantity change isn't rolled back when the API rejects it (out of stock); the cart shows 5 items, checkout fails.
- Every mutation invalidates everything (`queryClient.invalidateQueries()`); one click refetches 14 queries.

## Concepts

### useMutation
```ts
const cancel = useMutation({
  mutationFn: (orderId: number) => apiFetch<void>(`/orders/${orderId}/cancel`, { method: "POST" }),
  onSuccess: (_data, orderId) => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  },
});
cancel.mutate(1042);            // fire-and-forget with callbacks
await cancel.mutateAsync(1042); // await it (wrap in try/catch)
```
| State / option | Meaning |
|:--|:--|
| `isPending`, `isError`, `isSuccess`, `error`, `data` | mutation status |
| `variables` | what was sent (handy for optimistic UI) |
| `onMutate` → returns context | runs before the request (optimistic updates) |
| `onError(err, vars, context)` | roll back |
| `onSuccess(data, vars)` | update/invalidate cache |
| `onSettled` | always: final invalidation |
| `retry` | default 0 for mutations |
| `mutationKey` + `useMutationState` | track mutations elsewhere (global "saving…") |

### Updating the cache after a write
| Strategy | When | Code |
|:--|:--|:--|
| ⭐ invalidate | default; refetches active queries for those keys | `invalidateQueries({ queryKey: getGetOrdersQueryKey() })` |
| `setQueryData` | response contains the new entity; avoid a refetch | `setQueryData(getGetOrderQueryKey(id), updated)` |
| both | update detail from response, invalidate lists | |
| remove | entity deleted | `removeQueries({ queryKey })` |

Invalidate as narrowly as possible: the entity's detail key and the list keys it appears in.

### Optimistic updates
Two styles in v5:
1. **UI-only, via `variables`**: render the pending item from `mutation.variables` while `isPending`; nothing to roll back. Best for adding items to a list.
2. **Cache-level, via `onMutate`**: cancel outgoing fetches, snapshot, write the optimistic value, return the snapshot; `onError` restores it; `onSettled` invalidates.

Use optimistic UI for small, likely-to-succeed, reversible changes (quantity, favorites, notes). Don't use it for payments, stock reservations, or anything the API often rejects. React 19's `useOptimistic` (04-framework) is the component-local version.

### Errors from the API
The fetcher turns ASP.NET Core Problem Details into `ApiError`. In mutations:
| Status | Meaning | UI |
|:--|:--|:--|
| 400 with `errors` | validation problem | map to form fields (10-forms) |
| 409 | conflict (already shipped, version changed) | explain, refetch |
| 412 | `If-Match` failed (stale `ETag`/`rowversion`) | "someone else changed this", reload |
| 429 | rate limited | wait `Retry-After` |
| 5xx | server/infra | generic message, keep user input |

## Example
`web/src/features/cart/useUpdateCartLine.ts`
```ts
import { useQueryClient } from "@tanstack/react-query";
import { getGetCartQueryKey, useUpdateCartLine as useGenerated } from "@/api/generated/cart/cart";
import type { CartDto } from "@/api/generated/model";

export function useUpdateCartLine() {
  const qc = useQueryClient();
  const key = getGetCartQueryKey();

  return useGenerated({
    mutation: {
      onMutate: async ({ sku, data }) => {
        await qc.cancelQueries({ queryKey: key });                       // don't let a refetch overwrite us
        const previous = qc.getQueryData<CartDto>(key);
        qc.setQueryData<CartDto>(key, (cart) => cart && {
          ...cart,
          lines: cart.lines.map((l) => (l.sku === sku ? { ...l, quantity: data.quantity } : l)),
        });
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(key, ctx.previous);          // roll back
      },
      onSettled: () => qc.invalidateQueries({ queryKey: key }),         // server totals are the truth
    },
  });
}
```
Usage: `updateLine.mutate({ sku: "COF-1", data: { quantity: 3 } })`. Totals, discounts, and stock come back from the API on the follow-up refetch; the optimistic change only touches what the user typed.

## Production patterns
- Every mutation decides explicitly: invalidate which keys, or set which data.
- Optimistic updates only where rollback is easy and failures are rare; always `onSettled` invalidate to converge on server truth.
- Disable the submit button with `isPending`, and send an `Idempotency-Key` for creates.
- Handle 409/412 deliberately; they are normal in concurrent systems (03-backend/02-api-design, `rowversion` in 03-databases).

## Mistakes
Wrong: invalidate everything.
```ts
onSuccess: () => queryClient.invalidateQueries();
```
Right: invalidate the keys that changed (`getGetOrderQueryKey(id)`, `getGetOrdersQueryKey()`).

Wrong: optimistic update without `cancelQueries`.
Right: cancel in-flight queries for that key first, or a late response overwrites the optimistic value.

## Check yourself
1. When is `setQueryData` better than invalidation?
2. Why call `cancelQueries` in `onMutate`?
3. Which status code tells you an optimistic-concurrency check failed?

<details><summary>Answers</summary>

1. When the mutation's response already contains the updated entity, so a refetch would only repeat it.
2. An in-flight fetch started before the mutation could finish afterward and overwrite the optimistic value with old data.
3. 412 Precondition Failed (an `If-Match` ETag mismatch); some APIs use 409.
</details>

## Sources
- [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [TanStack Query — Invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [TanStack Query — Optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TkDodo — Mastering mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)
