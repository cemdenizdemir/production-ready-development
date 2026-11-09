---
title: Forces, layers, n-tier, and UI patterns
tech: TypeScript, Express 5, Next.js 16, React 19.2
version: Express 5.2, Next.js 16, React 19.2
date: 2026-11-07
covers: [1, 2, 3]
---
# Forces, layers, n-tier, and UI patterns
[← Overview](00-overview.md)

## Why it matters
- A team calls its app "3-tier" because it has controllers, services, and repositories, then puts all three plus the database on one VM. They mixed up layers (code) and tiers (machines) and can't scale the parts separately.
- A strict layered design forces every read through four layers of pass-through methods. Simple features take days.
- In a React app, data fetching, business rules, and markup live in the same 400-line components. The same discount rule exists in three components with different bugs.

## Concepts

### Architecture is about forces
| Quality attribute | Question |
|:--|:--|
| Changeability / maintainability | how cheap is a typical change? |
| Scalability | can load grow without a redesign? |
| Availability / reliability | what happens when parts fail? |
| Performance | latency and throughput targets |
| Security | where are the trust boundaries? |
| Testability | can rules be tested without infrastructure? |
| Deployability | how often and how safely can we release? |
| Cost and team fit | can this team build and run it? |

Every style trades some attributes for others. "Which style is best?" has no answer; "which style best fits these forces?" does.

### Layers vs tiers
| | Layers | Tiers |
|:--|:--|:--|
| Are | logical groupings of code by concern | physical deployment units (processes, machines) |
| Example | presentation · application · domain · infrastructure | browser · Next.js server · Express API · PostgreSQL |
| Boundary | function calls | network calls |
| Scales | understanding and change | load and isolation |

Classic layered architecture:
| Layer | Responsibility | In our stack |
|:--|:--|:--|
| Presentation | HTTP, UI | Express routes, Next.js pages |
| Application (service) | use cases, transactions, orchestration | use case functions |
| Domain (business) | rules, invariants | domain functions and entities |
| Infrastructure (data access) | DB, queues, external APIs | repositories, adapters |

| Variant | Rule | Trade-off |
|:--|:--|:--|
| Closed (strict) layers | each layer calls only the next one down | isolation, but pass-through code ("sinkhole") |
| Open layers | some layers can be skipped (e.g. reads go straight to a query module) | less ceremony, more coupling |
| Classic layering's weakness | domain depends on the data layer below it | fixed by dependency inversion (lesson 02) |

### n-tier
| Tiers | Example |
|:--|:--|
| 1-tier | a desktop app with an embedded database |
| 2-tier | client + database (old client/server apps) |
| 3-tier | browser (presentation) · application server · database |
| n-tier | browser · CDN · Next.js server (presentation) · Express API (application) · Postgres/Redis (data) · workers |

Each tier scales, fails, and is secured separately; each hop adds latency and failure modes.

### UI patterns
| Pattern | Roles | Where it shows up |
|:--|:--|:--|
| MVC | Model (data + rules), View (rendering), Controller (input → model → view) | server-side frameworks (Rails, Spring MVC); Express routes act as controllers |
| MVP | Presenter holds view logic; passive View exposes an interface | Android (classic), WinForms, testable UI logic |
| MVVM | ViewModel exposes state and commands; View binds to it | Angular, WPF, SwiftUI, Vue; React hooks play the ViewModel role |
| Component-based | components own render + local state; data flows down, events up | React, Vue, Svelte |
| Flux / unidirectional | actions → store → view | Redux, Zustand; TanStack Query for server state |

React mapping: **presentational components ≈ View**, **custom hooks ≈ ViewModel** (state + commands), **API client / query cache ≈ Model access**, while real business rules stay in the API's domain layer.

## Example
Layers in one feature (Express API), with dependencies pointing downward:
```ts
// presentation: orders.routes.ts — HTTP only (controller in MVC terms)
router.post('/orders/:id/cancellation', async (req, res) => {
  const { id } = OrderIdParams.parse(req.params);
  res.json(toOrderDTO(await orders.cancel(req.user!.accountId, id)));
});

// application: orders.service.ts — use case, transaction
export const createOrdersService = ({ db }: { db: Db }) => ({
  cancel: (accountId: string, id: string) => db.transaction(async (tx) => {
    const order = await ordersRepo.getForAccount(tx, accountId, id);
    return ordersRepo.save(tx, cancel(order));            // domain rule applied here
  }),
});

// domain: orders.domain.ts — rules
export function cancel(order: Order): Order {
  if (order.status !== 'pending' && order.status !== 'paid') throw new ConflictError('order.not_cancellable', `Order is ${order.status}`);
  return { ...order, status: 'cancelled' };
}
```
MVVM with React: the hook is the ViewModel, the component is the View.
```tsx
// ViewModel: state + commands, no markup
function useCartViewModel() {
  const cart = useQuery({ queryKey: ['cart'], queryFn: api.getCart });
  const remove = useMutation({ mutationFn: api.removeLine, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }) });
  return {
    lines: cart.data?.lines ?? [],
    totalLabel: cart.data ? formatMoney(cart.data.totalCents) : '—',
    isLoading: cart.isPending,
    removeLine: (productId: string) => remove.mutate(productId),
  };
}

// View: renders what the ViewModel exposes
export function CartView() {
  const vm = useCartViewModel();
  if (vm.isLoading) return <CartSkeleton />;
  return (
    <section aria-label="Cart">
      {vm.lines.map((l) => <CartLine key={l.productId} line={l} onRemove={() => vm.removeLine(l.productId)} />)}
      <p>Total: {vm.totalLabel}</p>
    </section>
  );
}
```

## In our stack
- Tiers: CloudFront → ALB → Next.js (ECS) → Express API (ECS) → RDS/ElastiCache, plus workers ([04-shipping/02-cloud](../../../04-shipping/02-cloud/README.md)).
- Layers inside a module: [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-goals-layers-modules.md).
- Component patterns and hooks: [02-frontend/04-framework](../../../02-frontend/04-framework/README.md), [03-design-patterns lesson 04](../../03-design-patterns/docs/04-application-frontend-antipatterns.md).

## When not to
- Don't add a tier (a separate API service) for a small app the Next.js server can serve alone; every tier adds latency and operations.
- Don't force strict layers on simple reads; a query module can read directly.
- Don't put business rules in ViewModels or Server Actions; they belong in the domain on the server.

## Production patterns
- **Quality attributes written down** before choosing a style.
- **Layers for code, tiers for deployment**, named precisely in docs and reviews.
- **Thin controllers/routes and thin ViewModels**; rules in the domain layer.
- **Open layers for reads** where strictness only adds pass-through code.

## Mistakes
Wrong: calling layered code "3-tier" and deploying it as one process anyway. Right: say "layered monolith"; split tiers only when scaling or isolation needs it.

Wrong: domain functions importing the ORM (`import { db } from '../db'`). The core depends on infrastructure. Right: dependency inversion (lesson 02).

Wrong: React components doing fetching, rules, and markup together. Right: hooks for state and commands, components for rendering, rules in the API.

## Check yourself
1. What's the difference between a layer and a tier?
2. What's the "sinkhole" problem of strictly closed layers?
3. How do React hooks and components map to MVVM?

<details>
<summary>Answers</summary>

1. A layer is a logical grouping of code by concern, communicating through function calls; a tier is a physical deployment unit, communicating over the network. Several layers usually run in one tier.
2. Requests pass through layers that add nothing (a service method that only calls the repository), adding code and indirection without value. Opening some layers (direct read queries) avoids it.
3. Presentational components are the View, custom hooks act as the ViewModel (they expose state and commands derived from data), and the API client or query cache is the access to the Model, whose real rules live on the server.
</details>

## Sources
- [Mark Richards — Software Architecture Patterns (layered architecture)](https://www.oreilly.com/library/view/software-architecture-patterns/9781098134280/)
- [Microsoft — N-tier architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/n-tier)
- [Martin Fowler — GUI architectures (MVC, MVP)](https://martinfowler.com/eaaDev/uiArchs.html)
- [Microsoft — The MVVM pattern](https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm)
- [ISO/IEC 25010 — Software quality model](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010)
