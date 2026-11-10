---
title: Forces, layered and n-tier, and UI patterns
tech: C#, ASP.NET Core 10, Next.js 16, React 19.2
version: .NET 10, Next.js 16, React 19.2
date: 2026-11-09
covers: [1, 2, 3]
---
# Forces, layered and n-tier, and UI patterns
[← Overview](00-overview.md)

## Why it matters
- The team chose an architecture "because Netflix uses it". Nobody had listed the shop's actual needs (one team, moderate traffic, fast iteration), and the overhead slowed every feature.
- "Three-tier" meant three projects for one team, but also three deployments; every change needed coordinated releases of the web, API, and data-access service.
- Business rules lived in React components and in the API. The mobile app called the API directly and skipped the rules that only the web UI enforced.

## Concepts

### What styles solve: forces and quality attributes
| Quality attribute | Question | Shop priority |
|:--|:--|:--|
| ⭐ changeability | how cheap is the next feature? | high |
| ⭐ deployability | how safely and often can we release? | high |
| ⭐ scalability | can it handle peaks (sales)? | medium |
| ⭐ availability | does it stay up when parts fail? | high for checkout |
| performance | latency for key journeys | medium–high |
| security | blast radius, data protection | high |
| team autonomy | can teams ship independently? | low (one team now) |
| cost and operability | what does it take to run? | high (small team) |
| testability | can we test quickly and reliably? | high |

Every style improves some attributes and costs others. Write the top 3–5 attributes down before choosing (an ADR's context).

### Layered and n-tier
| Term | Meaning | Example |
|:--|:--|:--|
| ⭐ layer (logical) | code organised by responsibility; dependencies go one way | presentation → application → domain → infrastructure |
| ⭐ tier (physical) | separately deployed process or machine | browser, Next.js server, ASP.NET Core API, SQL Server |
| closed layers | each layer only calls the one below | avoids shortcuts, can add pass-through code |
| open layers | some layers may be skipped | queries read directly from data for speed |

Layers are about code; tiers are about deployment. The shop has 4 tiers (browser, Next.js, API, database) and, inside the API, layers per module. Adding tiers adds latency, failure points, and deployment coordination; add them for a reason (security boundary, scaling, team).

Layered architecture's weak spot: organising **only** by technical layer spreads one feature across all layers (see vertical slices, lesson 02).

### UI patterns
| Pattern | Idea | Where you see it |
|:--|:--|:--|
| MVC | controller handles input, model holds data, view renders | ASP.NET Core MVC/Razor, server-rendered sites |
| MVP | presenter drives a passive view | older WinForms/Web Forms apps |
| MVVM | view binds to a view model's observable state | WPF, .NET MAUI, Blazor (partly) |
| ⭐ component-based | UI = tree of components owning their state and rendering | React, Next.js, Blazor components |

How React and Next.js map:
| Concept | React / Next.js |
|:--|:--|
| view | components (JSX) |
| view model / presenter | hooks (`useCart`) and component state |
| model | server data via TanStack Query or Server Components; backend domain |
| controller | route handlers, Server Actions, Next.js routing |

Business rules belong in the backend domain; the UI may duplicate validation for UX, but the API enforces it.

## In our stack
- Tiers: Next.js on Container Apps, ASP.NET Core API on Container Apps, Azure SQL ([04-shipping/02-cloud](../../../04-shipping/02-cloud/README.md)).
- Layers inside modules: [03-backend/11-architecture lesson 01](../../../03-backend/11-architecture/docs/01-modular-monolith-layers-modules.md).
- Component-based UI with Server Components: [02-frontend/04-framework](../../../02-frontend/04-framework/README.md).
- Validation in both UI (Zod from Orval) and API: [02-frontend/10-forms](../../../02-frontend/10-forms/README.md), [03-backend/05-validation-abuse](../../../03-backend/05-validation-abuse/README.md).

## When not to
- Don't add a physical tier (a separate data-access service) when a layer (a project or folder) would do.
- Don't enforce strictly closed layers for read-only queries; pass-through services add nothing.
- Don't pick an architecture without stating which quality attributes it serves.

## Example
Quality attributes captured in an ADR context:
```markdown
# 1. Overall architecture for the shop
Status: Accepted (2026-03-01)
## Context
One team (5 engineers), MVP in 3 months, peaks of ~10x normal traffic during campaigns.
Top attributes: changeability, deployability, availability of checkout, low operating cost.
Not priorities yet: independent team deployments, multi-region active/active.
## Decision
Modular monolith (ASP.NET Core) + Next.js frontend on Azure Container Apps; Azure SQL; events between modules via outbox.
## Consequences
One deployable backend; module boundaries enforced by projects and tests; split later if a module needs separate scaling or a team.
```
Layer dependencies made explicit (project references, one module):
```xml
<!-- Shop.Ordering.csproj: domain, use cases, data in folders; contracts in a separate project -->
<ProjectReference Include="..\Shop.Ordering.Contracts\Shop.Ordering.Contracts.csproj" />
<!-- no reference to Shop.Api (presentation), no reference to other modules' internals -->
```
Business rule enforced in the API, mirrored in the UI for UX:
```csharp
// API (authoritative)
public static Result<Quantity> Create(int value) =>
    value is >= 1 and <= 99 ? new Quantity(value) : new Error("cart.invalid_quantity", "1–99", ErrorType.Validation);
```
```tsx
// UI (generated Zod schema from OpenAPI; instant feedback, not the source of truth)
<input type="number" min={1} max={99} {...register("quantity", { valueAsNumber: true })} />
```

## Production patterns
- Architecture choices start from a short list of prioritised quality attributes, recorded in an ADR.
- Tiers are added for concrete reasons (security, scaling, ownership); layers organise code inside each tier.
- UI is component-based; the backend owns business rules; the UI mirrors validation only for user experience.

## Mistakes
Wrong: "We use a 5-tier architecture" (web → BFF → API → service layer → data service) for one team's CRUD app.
Right: browser → Next.js → API → database, with layers inside the API.

Wrong: discount eligibility computed only in a React component.
Right: computed by the API's domain; the UI displays the result.

## Check yourself
1. What's the difference between a layer and a tier?
2. Why list quality attributes before choosing a style?
3. Where do business rules belong in a React + ASP.NET Core system?

<details><summary>Answers</summary>

1. A layer is a logical grouping of code by responsibility within a deployable; a tier is a physically separate deployment (process, container, machine) that communicates over a network.
2. Styles trade attributes against each other; without knowing which matter most (changeability, availability, cost, autonomy), you can't judge whether a style's costs are worth paying.
3. In the backend domain, enforced by the API. The UI can repeat validation for fast feedback, but every client (web, mobile, partners) must get the same rules from the server.
</details>

## Sources
- [Azure Architecture Center — N-tier style](https://learn.microsoft.com/azure/architecture/guide/architecture-styles/n-tier)
- [Common web application architectures (.NET)](https://learn.microsoft.com/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)
- [ISO/IEC 25010 quality model](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010)
- [Martin Fowler — GUI architectures](https://martinfowler.com/eaaDev/uiArchs.html)
- [React — Thinking in React](https://react.dev/learn/thinking-in-react)
