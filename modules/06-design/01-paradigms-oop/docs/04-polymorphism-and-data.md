---
title: Polymorphism without classes; entities, values, and DTOs
tech: TypeScript 6 (strict)
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [7, 8]
---
# Polymorphism without classes; entities, values, and DTOs
[← Overview](00-overview.md)

## Why it matters
- A `NotificationService` has a 200-line `switch (channel)` repeated in four methods. Adding WhatsApp means editing all four, and one is missed.
- Two `Money` objects with the same amount compare as different (`a === b` is false), so a cart deduplication bug charges twice.
- The API returns database rows directly. A new `password_hash` column appears in a JSON response the next day.

## Concepts

### Kinds of polymorphism in TypeScript
| Kind | How | Example |
|:--|:--|:--|
| Subtype (interface) | values implementing the same interface | `PaymentGateway` implementations |
| Structural typing | any value with the right shape fits | an object literal satisfies an interface without `implements` |
| Parametric (generics) | code works for any type `T` | `Repository<T>`, `Result<T, E>` |
| Ad hoc (overloads, maps) | behavior chosen by input type | function overloads, a map from kind to handler |
| Dispatch tables | a record of functions keyed by a discriminant | `handlers[event.type](event)` |

Structural typing means "if it walks like a duck": types are compatible when shapes match, regardless of names. Branded types add nominal-like safety where needed.

### Objects and data
| Kind | Identity | Equality | Mutability | Example |
|:--|:--|:--|:--|:--|
| Entity | has a stable ID | by ID | changes over time through methods | Order, User, Product |
| Value object | none | by value (all fields) | immutable | Money, Email, Address, DateRange |
| DTO | none | not relevant | plain data | API request/response, job payload |
| Record/row | primary key | — | persistence shape | Drizzle row types |

Rules:
- **Entities** protect invariants; compare with IDs (`a.id === b.id`).
- **Value objects** validate on creation, never change, and compare by value; replace them instead of mutating.
- **DTOs** are separate from rows and domain objects, so storage changes don't leak into APIs.

### Immutability tools
| Tool | Effect |
|:--|:--|
| `readonly` / `Readonly<T>` / `ReadonlyArray<T>` | compile-time protection |
| `as const` | literal, readonly types |
| `Object.freeze` | shallow runtime protection |
| `structuredClone` | deep copy (no functions, no class prototypes) |
| Spread `{ ...obj, field }` | shallow copy with changes |

## Example
Dispatch table instead of repeated `switch`:
```ts
type Notification =
  | { channel: 'email'; to: string; subject: string; body: string }
  | { channel: 'sms'; to: string; text: string }
  | { channel: 'push'; deviceToken: string; title: string };

type Sender<N> = (n: N) => Promise<void>;
type Senders = { [K in Notification['channel']]: Sender<Extract<Notification, { channel: K }>> };

export function createNotifier(senders: Senders) {
  return {
    send(n: Notification): Promise<void> {
      return (senders[n.channel] as Sender<Notification>)(n);     // one place dispatches by kind
    },
  };
}

// Adding 'whatsapp' to the union makes `Senders` require a new function: the compiler finds every gap
```
A value object: `Money`.
```ts
export type Currency = 'EUR' | 'USD';

export class Money {
  readonly amountCents: number;
  readonly currency: Currency;

  private constructor(amountCents: number, currency: Currency) {   // private constructor: use the factories
    this.amountCents = amountCents;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(amountCents: number, currency: Currency): Money {
    if (!Number.isSafeInteger(amountCents)) throw new RangeError('amount must be an integer number of cents');
    return new Money(amountCents, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error(`currency mismatch: ${this.currency} vs ${other.currency}`);
    return Money.of(this.amountCents + other.amountCents, this.currency);
  }

  multiply(factor: number): Money {
    return Money.of(Math.round(this.amountCents * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }

  format(locale = 'de-DE'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(this.amountCents / 100);
  }
}
```
`private constructor` is erasable: it's only a type-level modifier, unlike parameter properties.

Entity, row, and DTO kept apart:
```ts
// Persistence shape (Drizzle infers it from the table)
type UserRow = { id: string; email: string; password_hash: string; created_at: Date };

// Domain entity: identity + behavior
class User {
  readonly id: string;
  #email: string;
  constructor(id: string, email: string) { this.id = id; this.#email = email; }
  get email() { return this.#email; }
  changeEmail(next: string) { if (!next.includes('@')) throw new Error('invalid email'); this.#email = next.toLowerCase(); }
}

// Output DTO: exactly what clients may see
export type UserDTO = { id: string; email: string };
export const toUserDTO = (u: User): UserDTO => ({ id: u.id, email: u.email });
```

## In our stack
- Dispatch by discriminant: BullMQ job handlers and Stripe event handling ([03-backend/12-integrations lesson 02](../../../03-backend/12-integrations/docs/02-stripe-webhooks-reconciliation.md)).
- Generics: `Result<T, E>`, typed repositories, TanStack Query hooks.
- DTO mapping: `toOrderDTO` in [03-backend/02-api-design](../../../03-backend/02-api-design/README.md); value objects such as money in [05-domain-driven-design](../../05-domain-driven-design/README.md).

## When not to
- Don't make every primitive a class; branded types (`string & { __brand: 'Email' }`) are often enough.
- Don't add a DTO layer for internal scripts that never leave the process.
- Don't freeze objects in performance-critical loops; rely on `readonly` types there.

## Production patterns
- **Dispatch tables typed from the union**, so new variants become compile errors where handling is missing.
- **Value objects for money, quantities, emails, ranges**: validated once, immutable, compared by value.
- **Separate rows, domain objects, and DTOs** at module boundaries.
- **Structural typing plus brands** where mixing up IDs or units would be costly.

## Mistakes
Wrong: the same `switch` in many places.
```ts
function send(n) { switch (n.channel) { /* … */ } }
function log(n) { switch (n.channel) { /* … */ } }   // copies drift apart
```
Right: one typed dispatch table, or one polymorphic interface.

Wrong: comparing value objects by reference (`a === b`). Right: `a.equals(b)`, or compare primitive fields.

Wrong: returning rows from routes (`res.json(row)`). New columns leak. Right: explicit DTO mappers.

## Check yourself
1. What is structural typing, and what problem do branded types solve on top of it?
2. How do entities and value objects differ in equality and mutability?
3. Why keep DTOs separate from database rows?

<details>
<summary>Answers</summary>

1. Types are compatible when their shapes match, regardless of their names, so any object with the right fields satisfies an interface. That also lets an `OrderId` string be passed where a `UserId` string is expected; brands add a phantom field that makes such types incompatible at compile time.
2. Entities have identity and are equal when their IDs match, even as their other data changes through methods. Value objects have no identity: they're equal when all fields match, and they're immutable, so you replace them instead of changing them.
3. Rows follow storage needs and change with migrations; DTOs are a public contract. Mapping explicitly keeps new or sensitive columns from leaking into responses and lets each side change independently.
</details>

## Sources
- [TypeScript Handbook — Type compatibility (structural typing)](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript Handbook — Mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
- [Martin Fowler — Value object](https://martinfowler.com/bliki/ValueObject.html)
- [Martin Fowler — Data transfer object](https://martinfowler.com/eaaCatalog/dataTransferObject.html)
- [MDN — structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
