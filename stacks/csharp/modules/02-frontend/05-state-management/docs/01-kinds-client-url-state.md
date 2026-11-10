---
title: Kinds of state, client state, and URL state
tech: React 19.2, Next.js 16
version: React 19.2, Next.js 16
date: 2026-11-09
covers: [1, 8, 9]
---
# Kinds of state, client state, and URL state
[← Overview](00-overview.md)

## Why it matters
- A global store holds `products`, `cart`, `user`, `filters`, and `isMenuOpen`. After a price change in the admin, customers see old prices until they reload.
- Filters live in component state; a customer shares a link to "light roasts under €15" and the recipient sees all products.
- A context with the whole cart re-renders 300 components on every quantity change.

## Concepts

### Five kinds of state
| Kind | Examples | Owner | Tool |
|:--|:--|:--|:--|
| ⭐ server | products, orders, current user profile | ASP.NET Core API | TanStack Query cache |
| ⭐ URL | filters, sort, page, selected tab, search query | the address bar | search params |
| form | values being typed, validation errors | the form | React Hook Form (10-forms) |
| client UI | menu open, dialog open, theme toggle | the component | `useState`, `useReducer` |
| derived | totals, filtered lists, "is free shipping" | computed | render-time computation |

Ask in order: Is it from the server? → query cache. Should a link or reload preserve it? → URL. Is it a form? → form library. Otherwise → local state, lifted only as far as needed.

### Client state tools
| Tool | Use | Watch out |
|:--|:--|:--|
| `useState` / `useReducer` | most UI state | lift to the closest common parent |
| context | rarely changing values for many components (theme, locale, auth session info) | every consumer re-renders on change; split contexts, keep values stable |
| external store (Zustand, Jotai) | lots of shared client-only state (complex editors, multi-panel UIs) | rarely needed in a CRUD shop; never for server data |
| `localStorage` | persistence of preferences | read in an effect or `useSyncExternalStore` to avoid hydration mismatch |

The cart is server state in this stack (the API owns prices, stock, and totals). An anonymous cart can be a cookie-identified server cart, so the API stays the source of truth.

### URL as state
| Benefit | |
|:--|:--|
| shareable and bookmarkable | links reproduce the view |
| back/forward work | history is the state history |
| survives reload | no persistence code |
| server-readable | Server Components get `searchParams`, render the filtered list on the server |

In Next.js App Router: `useSearchParams()` (read, client), `useRouter().replace()` or `<Link href>` (write), `searchParams` prop (server pages). Keep keys short and validated (`?roast=light&max=15&sort=price&page=2`), parse with a schema, and fall back to defaults for bad values.

Rule: navigation-like changes (`page`, `tab`) `push`; typing in a filter `replace` (debounced) so the history isn't flooded.

## Example
`web/src/features/catalog/useCatalogFilters.ts`
```ts
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { z } from "zod";

const Filters = z.object({
  roast: z.enum(["light", "medium", "dark"]).optional().catch(undefined),
  max: z.coerce.number().int().positive().max(500).optional().catch(undefined),
  sort: z.enum(["price", "name", "new"]).default("new").catch("new"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});
export type CatalogFilters = z.infer<typeof Filters>;

export function useCatalogFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = Filters.parse(Object.fromEntries(params));

  function update(next: Partial<CatalogFilters>, mode: "push" | "replace" = "push") {
    const merged = { ...filters, ...next, page: next.page ?? 1 };   // new filter → back to page 1
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== undefined) sp.set(k, String(v));
    router[mode](`${pathname}?${sp}`, { scroll: false });
  }

  return { filters, update };
}
```
Components call the generated query with these filters (`useGetProducts(filters)`, lesson 02), so the URL drives what's fetched.

## Production patterns
- No server data in context or global stores; components read it from the query cache by key.
- Shareable state (filters, sort, page, tab) in the URL, parsed with a schema; defaults omitted from the URL.
- Split contexts by update frequency; pass stable values (`useMemo` or the compiler) so consumers don't re-render needlessly.
- Persist only preferences locally (theme, dismissed banners); never auth tokens.

## Mistakes
Wrong: copying query data into state.
```tsx
const { data } = useGetProducts();
const [products, setProducts] = useState(data);     // stale copy, never updated
```
Right: use `data` directly; derive filtered views during render.

Wrong: filters in `useState` on a list page.
Right: search params, so links and reloads work.

## Check yourself
1. Where should a product's price live in the frontend, and why?
2. Why `replace` instead of `push` while the user types in a search box?
3. What happens to consumers when a context value changes?

<details><summary>Answers</summary>

1. In the TanStack Query cache, keyed by product; the API owns it and the cache knows when it's stale.
2. Every keystroke would add a history entry; Back would step through each character.
3. Every component that reads that context re-renders.
</details>

## Sources
- [TanStack — Does this replace client state?](https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state)
- [react.dev — Managing state](https://react.dev/learn/managing-state)
- [Next.js — useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Kent C. Dodds — Application state management with React](https://kentcdodds.com/blog/application-state-management-with-react)
