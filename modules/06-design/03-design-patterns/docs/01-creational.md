---
title: Creational patterns and dependency injection
tech: TypeScript 6 (strict), Node.js 26
version: TypeScript 6.0, Node.js 26 LTS
date: 2026-11-07
covers: [1, 2, 3]
---
# Creational patterns and dependency injection
[← Overview](00-overview.md)

## Why it matters
- A module-level `export const db = new Pool(…)` singleton connects at import time. Tests can't run without a database, and two test files share the same pool state.
- `new StripeClient(process.env.KEY)` is scattered across 14 files. Rotating keys or adding timeouts means 14 edits.
- An email object is built with 11 constructor arguments; two of them are swapped and invoices go to the wrong address.

## Concepts

### Patterns as vocabulary
| Part of a pattern | Meaning |
|:--|:--|
| Name | shared word for the solution |
| Problem | the recurring situation |
| Forces | what pulls in different directions (flexibility vs simplicity, performance, testability) |
| Solution | the structure, usually roles and relationships |
| Consequences | trade-offs, including costs |

In TypeScript, classic class-based patterns often shrink: a **factory method** becomes a function, a **strategy** a function value, a **singleton** a module instance created at the composition root.

### Creational patterns
| Pattern | Problem | TypeScript form |
|:--|:--|:--|
| Factory function | hide construction details, validate input | `createX(config)` returning an object |
| Factory method | subclasses decide what to create | a function parameter or an overridable method |
| Abstract factory | create families of related objects consistently | an object of factory functions per environment |
| Builder | many optional parts, step-by-step construction | fluent builder or an options object |
| Prototype | clone a preconfigured object | `structuredClone`, spread |
| Singleton | exactly one instance | one instance created in the composition root (avoid global singletons) |
| Object pool | reuse expensive objects | DB connection pools, worker pools |

### Dependency injection
| Approach | Description |
|:--|:--|
| Constructor/parameter injection | pass dependencies to the factory or constructor |
| Composition root | one place creates and wires everything |
| Service locator | code asks a global registry for dependencies (avoid: hidden dependencies) |
| DI container | automatic wiring (also seen: NestJS, awilix, InversifyJS) |

Why singletons are risky: hidden global state, import-order side effects, hard-to-test code, impossible to have two configurations (tests, multi-tenant). The **instance** may be single; the **access** shouldn't be global.

## Example
Factory function: validation and defaults in one place.
```ts
type HttpClientOptions = { baseUrl: string; timeoutMs?: number; retries?: number; headers?: Record<string, string> };

export function createHttpClient(opts: HttpClientOptions) {
  const url = new URL(opts.baseUrl);                                // fails fast on bad config
  const timeoutMs = opts.timeoutMs ?? 3_000;
  return {
    async getJson<T>(path: string): Promise<T> {
      const res = await fetch(new URL(path, url), { headers: opts.headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
      return (await res.json()) as T;
    },
  };
}
```
Abstract factory: a consistent family per environment.
```ts
type Infrastructure = { mailer: Mailer; payments: PaymentGateway; files: FileStore };

const productionInfrastructure = (cfg: Config): Infrastructure => ({
  mailer: createSesMailer(cfg.ses),
  payments: createStripeGateway(cfg.stripe),
  files: createS3FileStore(cfg.s3),
});

const localInfrastructure = (): Infrastructure => ({
  mailer: createConsoleMailer(),
  payments: createFakeGateway().gateway,
  files: createDiskFileStore('./tmp/files'),
});

export const infrastructureFor = (cfg: Config) => (cfg.app.env === 'production' ? productionInfrastructure(cfg) : localInfrastructure());
```
Builder for complex values (or an options object when there are no steps):
```ts
export class EmailBuilder {
  #to: string[] = [];
  #subject = '';
  #html = '';
  #text = '';
  #tags: Record<string, string> = {};

  to(...addresses: string[]) { this.#to.push(...addresses); return this; }
  subject(s: string) { this.#subject = s; return this; }
  body(html: string, text: string) { this.#html = html; this.#text = text; return this; }
  tag(key: string, value: string) { this.#tags[key] = value; return this; }

  build(): Readonly<Email> {
    if (this.#to.length === 0) throw new Error('email needs at least one recipient');
    if (!this.#subject || !this.#text) throw new Error('email needs a subject and a text body');
    return Object.freeze({ to: [...this.#to], subject: this.#subject, html: this.#html, text: this.#text, tags: { ...this.#tags } });
  }
}

const email = new EmailBuilder().to('a@example.com').subject('Your order').body(html, text).tag('type', 'order-confirmation').build();
```
Singleton done right: one instance, created at the root, passed down.
```ts
// Wrong: global instance created at import time
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Right: created once by the composition root, injected where needed
export async function createDeps(config: Config) {
  const pool = new Pool({ connectionString: config.db.url, max: 10 });
  return { pool, orders: createOrdersService({ pool }), close: () => pool.end() };
}
```

## In our stack
- Composition root and factory functions: `createDeps` in [03-backend/11-architecture lesson 02](../../../03-backend/11-architecture/docs/02-di-ports-adapters.md).
- Object pools: `pg` connection pools, the worker thread pool in [03-backend/09-scalability lesson 02](../../../03-backend/09-scalability/docs/02-scaling-nodejs.md).
- Builders: Drizzle's query builder, `URLSearchParams`, Zod schema builders.

## When not to
- No builder for objects with three fields; use an object literal or options object.
- No abstract factory when there's only one environment-specific piece; pass that one dependency.
- No DI container in a codebase where a 40-line composition root does the job.

## Production patterns
- **Factory functions** that validate config and hide construction.
- **One composition root per process**; instances that must be unique are created there, not at import time.
- **Families of adapters per environment** (production, local, test) built consistently.
- **Builders or options objects** instead of long positional parameter lists.

## Mistakes
Wrong: `getInstance()` singletons with lazy global state. Hidden coupling, shared state between tests. Right: create once at the root, inject.

Wrong: `new` for infrastructure clients inside business functions. Right: inject them.

Wrong: positional constructors with many same-typed parameters (`new Email(a, b, c, d, e)`). Right: options objects with names, or a builder that validates.

## Check yourself
1. Why is "one instance" fine but "global access to the instance" a problem?
2. When does a builder beat an options object?
3. What does an abstract factory guarantee?

<details>
<summary>Answers</summary>

1. A single instance (one pool, one config) is often correct. Global access hides dependencies, creates import-order side effects, shares state across tests, and makes a second configuration impossible. Creating the instance in the composition root and passing it down keeps one instance without global coupling.
2. When construction has steps, conditional parts, or validation that depends on several parts together (an email that needs recipients and a body), and when the result should be immutable. For flat data with defaults, an options object is simpler.
3. That related objects are created as a consistent family: all production adapters together, or all local fakes together, so you never mix, say, a real payment provider with a fake mailer by accident.
</details>

## Sources
- [refactoring.guru — Creational patterns](https://refactoring.guru/design-patterns/creational-patterns)
- [Mark Seemann — Composition root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/)
- [Mark Seemann — Service locator is an anti-pattern](https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/)
- [patterns.dev — Singleton pattern](https://www.patterns.dev/vanilla/singleton-pattern/)
