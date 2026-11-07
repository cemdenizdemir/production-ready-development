---
title: OOP pillars, composition, and TypeScript classes
tech: TypeScript 6 (strict)
version: TypeScript 6.0 (erasableSyntaxOnly), Node.js 26 LTS
date: 2026-11-07
covers: [2, 3, 4]
---
# OOP pillars, composition, and TypeScript classes
[← Overview](00-overview.md)

## Why it matters
- `order.status = 'shipped'` is set from five places. One of them skips the stock check, and orders ship without stock. Nothing protected the rule.
- `class AdminUser extends PremiumUser extends User`: a change in `User` breaks admins, and a "premium admin" can't exist without a new class.
- `private` in TypeScript is only a compile-time hint. A JavaScript caller (or `as any`) reads the "private" token anyway.

## Concepts

### The four pillars
| Pillar | Meaning | TypeScript tool |
|:--|:--|:--|
| Encapsulation | hide state; change it only through methods that keep the rules | `#private` fields, closures, `readonly` |
| Abstraction | expose what something does, not how | interfaces, small public APIs |
| Inheritance | reuse and specialize behavior from a base class | `extends`, `super` |
| Polymorphism | one interface, many implementations | interfaces, structural typing, overriding |

### Composition over inheritance
| Inheritance (is-a) | Composition (has-a / uses-a) |
|:--|:--|
| behavior fixed at class definition | behavior assembled at runtime |
| deep hierarchies couple subclasses to base internals | small parts, combined freely |
| "fragile base class": base changes break children | parts change independently |
| one axis of variation | many axes (pricing × shipping × tax) |
| fits true, stable taxonomies (rare in business code) | fits most business variation |

Use inheritance sparingly: framework hooks (`class MyError extends Error`), small stable hierarchies, or template methods. Prefer interfaces plus composition for variation.

### Interfaces, abstract classes, mixins
| Tool | Use |
|:--|:--|
| `interface` / `type` | a contract with no implementation; implemented structurally |
| `abstract class` | shared implementation plus abstract members; single inheritance |
| Mixins (functions returning classes) | rare; composition is usually clearer |
| Function types | `type Notify = (msg: string) => Promise<void>` for one-method contracts |

### TypeScript classes under Node's type stripping
| Feature | Status |
|:--|:--|
| `#private` fields and methods | ✓ real runtime privacy |
| `private` / `protected` keywords | ✓ compile-time only; prefer `#` for real privacy |
| `readonly` fields | ✓ compile-time |
| `static` members, `static` blocks | ✓ |
| Getters / setters | ✓ (keep them cheap and side-effect free) |
| Parameter properties `constructor(private x: T)` | ✗ not erasable |
| `enum` | ✗ use unions or `as const` objects |
| Decorators | ✗ need a build step |
| `implements` | ✓ checks the class against an interface |

## Example
`src/cart.ts` — encapsulation: the only way to change the cart keeps its rules.
```ts
export type CartLine = { readonly productId: string; readonly unitPriceCents: number; readonly quantity: number };

export class Cart {
  static readonly MAX_LINES = 50;
  readonly #lines = new Map<string, CartLine>();
  #checkedOut = false;

  add(line: CartLine): void {
    this.#assertOpen();
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new RangeError('quantity must be a positive integer');
    const existing = this.#lines.get(line.productId);
    if (!existing && this.#lines.size >= Cart.MAX_LINES) throw new RangeError(`at most ${Cart.MAX_LINES} lines`);
    this.#lines.set(line.productId, { ...line, quantity: (existing?.quantity ?? 0) + line.quantity });
  }

  remove(productId: string): void {
    this.#assertOpen();
    this.#lines.delete(productId);
  }

  checkout(): readonly CartLine[] {
    this.#assertOpen();
    if (this.#lines.size === 0) throw new Error('cart is empty');
    this.#checkedOut = true;
    return [...this.#lines.values()];
  }

  get totalCents(): number {
    let total = 0;
    for (const l of this.#lines.values()) total += l.unitPriceCents * l.quantity;
    return total;
  }

  #assertOpen(): void {
    if (this.#checkedOut) throw new Error('cart already checked out');
  }
}
```
Composition over inheritance — shipping and tax rules as interchangeable parts:
```ts
interface ShippingRule { costCents(order: { totalCents: number; country: string }): number }
interface TaxRule { taxCents(order: { totalCents: number; country: string }): number }

const freeOver50: ShippingRule = { costCents: (o) => (o.totalCents >= 5_000 ? 0 : 499) };
const flatEu: ShippingRule = { costCents: () => 699 };
const germanVat: TaxRule = { taxCents: (o) => Math.round(o.totalCents * 0.19) };

export class OrderPricing {
  readonly #shipping: ShippingRule;
  readonly #tax: TaxRule;
  constructor(shipping: ShippingRule, tax: TaxRule) {
    this.#shipping = shipping;
    this.#tax = tax;
  }
  total(order: { totalCents: number; country: string }): number {
    return order.totalCents + this.#shipping.costCents(order) + this.#tax.taxCents(order);
  }
}

const pricing = new OrderPricing(freeOver50, germanVat);   // combine freely; no FreeShippingGermanOrder class
```
Inheritance where it fits: domain errors.
```ts
export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}
export class OutOfStockError extends DomainError {}
```

## In our stack
- `#private` state and lifecycle: circuit breaker and bulkhead in [03-backend/08-reliability lesson 03](../../../03-backend/08-reliability/docs/03-breakers-bulkheads-load-shedding.md).
- Composition: ports and adapters (`PaymentGateway` implementations) in [03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-di-ports-adapters.md).
- Inheritance used sparingly: the `DomainError` family ([03-backend/11-architecture lesson 03](../../../03-backend/11-architecture/docs/03-domain-errors-transactions.md)).

## When not to
- No class for a single function or for plain data (DTOs, API responses).
- No base class just to share two helper methods; use a function or composition.
- No getters and setters that just expose fields; either the object protects a rule or it's plain data.

## Production patterns
- **Encapsulate rules** behind methods; make illegal changes impossible from outside.
- **`#private`** for real privacy; `readonly` for things that never change after construction.
- **Compose behavior** from small interfaces; inherit only for stable, shallow hierarchies.
- **Erasable TypeScript only**: fields declared and assigned explicitly, unions instead of enums.

## Mistakes
Wrong: public mutable state.
```ts
class Order { status: 'pending' | 'paid' | 'shipped' = 'pending'; }
order.status = 'shipped'; // anywhere, without checks
```
Right: `order.ship()` that checks the current status and stock.

Wrong: deep inheritance for variation (`StandardOrder → ExpressOrder → ExpressGiftOrder`). Right: compose shipping, gift-wrap, and pricing rules.

Wrong: relying on `private` for security. It's erased at runtime. Right: `#private`, and never put secrets in objects you serialize.

## Check yourself
1. What's the difference between `private` and `#private` in TypeScript?
2. Why does composition usually beat inheritance for business variation?
3. Where is inheritance still a good fit?

<details>
<summary>Answers</summary>

1. `private` is checked only by the compiler and disappears in JavaScript, so other code can still read the property. `#private` is a JavaScript feature enforced at runtime: the field is truly inaccessible outside the class body.
2. Business rules vary along several independent axes (shipping, tax, discounts). Inheritance supports one axis and couples children to base internals, so combinations explode into subclasses. Composition combines small parts at runtime and lets each change independently.
3. Small, stable is-a hierarchies and framework extension points: custom `Error` subclasses, a template method in a base class, or extending a library class designed for it.
</details>

## Sources
- [MDN — Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties)
- [TypeScript Handbook — Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [TypeScript — erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly)
- [Gamma et al. — Design Patterns: "favor object composition over class inheritance"](https://en.wikipedia.org/wiki/Composition_over_inheritance)
