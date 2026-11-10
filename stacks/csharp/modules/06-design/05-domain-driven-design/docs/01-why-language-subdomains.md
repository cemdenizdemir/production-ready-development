---
title: Why DDD, ubiquitous language, and subdomains
tech: C# 14
version: C# 14 / .NET 10
date: 2026-11-09
covers: [1, 2, 3]
---
# Why DDD, ubiquitous language, and subdomains
[← Overview](00-overview.md)

## Why it matters
- Support said "the order was returned"; finance said "refunded"; the warehouse said "restocked"; the code had a single `IsReturned` flag. Partial returns were impossible to represent, and refunds were paid for items never received.
- Developers built a custom tax engine because "tax is just a percentage". It took four months; a tax service would have taken a week to integrate and handled 40 countries correctly.
- The team spent equal effort on every feature. The roast-subscription logic, which made the shop different from competitors, got the same attention as the newsletter signup.

## Concepts

### Why DDD
| Problem | DDD answer |
|:--|:--|
| ⭐ complex rules that change often | a model that mirrors the domain, so changes map to code clearly |
| ⭐ misunderstandings between experts and developers | a ubiquitous language used in conversations **and** code |
| one word, many meanings | bounded contexts: each meaning has its own model (lesson 02) |
| inconsistent rules | aggregates enforce invariants in one place (lesson 03) |
| effort spread evenly | subdomains: invest most in the core |

### Ubiquitous language
| Practice | How |
|:--|:--|
| ⭐ one term, one meaning (per context) | "Return" = customer sends items back; "Refund" = money back; "Restock" = items back in inventory |
| ⭐ the code uses the language | `order.RequestReturn(lines)`, `ReturnReceived`, `Refund.Issue()`; not `UpdateStatus(7)` |
| glossary | a short living document per context |
| domain experts in the loop | product, support, finance, warehouse review the terms |
| language changes → code changes | renames are part of modelling |

### Event storming
A workshop where developers and domain experts map a process with sticky notes (or a whiteboard tool):
| Sticky | Means | Example |
|:--|:--|:--|
| ⭐ domain event (orange) | something that happened, past tense | `Order Placed`, `Payment Captured`, `Return Received` |
| command (blue) | an intention that causes events | `Place Order`, `Request Return` |
| actor (yellow) | who issues the command | customer, support agent |
| policy (lilac) | "whenever X, then Y" | "whenever Return Received, then Issue Refund" |
| aggregate (pale yellow) | what accepts the command and enforces rules | `Order`, `Return` |
| external system (pink) | outside dependencies | Stripe, carrier |
| hotspot (red) | question, conflict, risk | "partial refunds for damaged items?" |

Big-picture event storming finds boundaries and hotspots; process-level and design-level sessions find aggregates and commands.

### Subdomains
| Type | Meaning | Shop | Strategy |
|:--|:--|:--|:--|
| ⭐ core | what makes the business different | roast subscriptions, personalised recommendations, freshness-based pricing | build, best people, rich model (DDD) |
| ⭐ supporting | necessary, specific to you, not differentiating | returns handling, loyalty points | build simply, or customise |
| ⭐ generic | solved problems every business has | payments, tax, email, identity, search | **buy or use a service** (Stripe, ACS, Entra) |

## In our stack
- Module names follow the language: Catalog, Ordering, Payments, Loyalty, Notifications ([03-backend/11-architecture](../../../03-backend/11-architecture/README.md)).
- Generic subdomains bought: Stripe (payments), ACS (email), Azure services ([03-backend/12-integrations](../../../03-backend/12-integrations/README.md)).
- Domain events in code: `OrderPlaced`, `PaymentSucceeded` ([03-backend/11-architecture lesson 04](../../../03-backend/11-architecture/docs/04-events-transactions.md)).
- The capstone domain document starts with an event storming ([07-capstone](../../../07-capstone/README.md)).

## When not to
- Don't run multi-day event storming for a CRUD admin screen.
- Don't build generic subdomains yourself (payments, tax, auth) unless they're truly your differentiator.
- Don't invent a ubiquitous language the business doesn't use; discover theirs.

## Example
A glossary excerpt (`docs/domain/ordering-glossary.md`):
```markdown
| Term | Meaning (Ordering context) | Not to be confused with |
|:--|:--|:--|
| Order | A customer's confirmed purchase of one or more lines | Cart (not yet confirmed) |
| Return | A request to send some lines back; may be partial | Refund (money), Restock (inventory) |
| Refund | Money returned to the customer for returned or cancelled lines | Chargeback (bank-initiated) |
| Subscription | A recurring order of a roast every N weeks | Newsletter subscription |
```
Language in code, before and after:
```csharp
// Before: technical words, hidden meaning
order.Status = 7;                          // 7 = "returned"?
orderService.UpdateOrder(order, flags: 0b101);

// After: the domain's words
var result = order.RequestReturn(lines: [new ReturnLine(lineId, quantity: 1, Reason.Damaged)], now);
// events: ReturnRequested → (warehouse) ReturnReceived → (policy) IssueRefund → RefundIssued
```
Subdomain classification as a team decision (ADR excerpt):
```markdown
Core: subscriptions (roast-to-order scheduling, freshness windows). Invest: rich model, DDD, best engineers.
Supporting: returns, loyalty. Build simply in the modular monolith.
Generic: payments (Stripe), tax (tax service), email (ACS), identity (ASP.NET Core Identity/Entra). Integrate behind ports.
```

## Production patterns
- A glossary per context, reviewed with domain experts; code, APIs, events, and tickets use its terms.
- Event storming at the start of significant work and when a domain feels confusing; hotspots become tickets or spikes.
- Subdomains classified explicitly; effort and architecture choices follow (rich models in the core, simple code or purchased services elsewhere).

## Mistakes
Wrong: `IsReturned`, `IsRefunded`, `IsRestocked` booleans on `Order`.
Right: explicit concepts (`Return`, `Refund`) with their own lifecycles and events.

Wrong: building an in-house payment processor "for flexibility".
Right: Stripe behind a port; invest the time in the core subdomain.

## Check yourself
1. What makes a language "ubiquitous"?
2. What's the difference between a domain event and a command on an event storming wall?
3. How should effort differ between core, supporting, and generic subdomains?

<details><summary>Answers</summary>

1. It's shared by domain experts and developers and used consistently everywhere: conversations, documentation, code, APIs, and events, within one bounded context.
2. A domain event is something that has happened (past tense, a fact); a command is an intention or request that may cause events if the rules allow it.
3. Core: invest most (rich model, strongest people, DDD). Supporting: build simply. Generic: buy or use existing services and integrate them behind ports.
</details>

## Sources
- [Eric Evans — Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [Alberto Brandolini — Introducing EventStorming](https://www.eventstorming.com/)
- [DDD Crew — EventStorming glossary](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
- [Azure — Domain analysis](https://learn.microsoft.com/azure/architecture/microservices/model/domain-analysis)
- [Martin Fowler — Ubiquitous language](https://martinfowler.com/bliki/UbiquitousLanguage.html)
