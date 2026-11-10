# Cheatsheet
Master checklist, one section per topic. The learn prompt appends sections.
Items are never reordered or deleted. ⭐ = must know for production.

## 01 · Foundations

### 01 · Git & Collaboration
[modules/01-foundations/01-git](modules/01-foundations/01-git) · Git, GitHub · [cheatsheet](modules/01-foundations/01-git/docs/cheatsheet.md)
- [ ] ⭐ Git's object model: blobs, trees, commits, refs, and HEAD
- [ ] ⭐ Atomic commits with clear messages (Conventional Commits)
- [ ] Everyday commands done right: `switch`, `restore`, `add -p`, `stash`
- [ ] Repo setup: global config, `.gitignore`, `.gitattributes` line endings, hooks
- [ ] ⭐ Trunk-based development with short-lived branches
- [ ] ⭐ Merge vs rebase vs squash, and when never to rewrite history
- [ ] Resolving conflicts: `zdiff3`, `rerere`, and checking the result
- [ ] Cleaning a branch before review: interactive rebase, fixup commits, autosquash
- [ ] ⭐ Undo and recovery: `reset`, `revert`, `reflog`
- [ ] Investigating history: `log -S`, `blame`, `bisect`
- [ ] ⭐ Pull requests that get merged: small, described, reviewable; CODEOWNERS
- [ ] ⭐ Protecting main: rulesets, required reviews and checks, merge queue
- [ ] ⭐ Keeping secrets out of Git, and responding when one leaks
- [ ] Signed commits and tags (SSH signing, verified badge)
- [ ] Tags, SemVer, and GitHub Releases

### 02 · HTTP & Networking
[modules/01-foundations/02-http-networking](modules/01-foundations/02-http-networking) · HTTP, Node.js 26, Express 5, curl, Chrome DevTools · [cheatsheet](modules/01-foundations/02-http-networking/docs/cheatsheet.md)
- [ ] ⭐ What happens on a request: DNS, TCP, TLS, HTTP, and where the latency goes
- [ ] ⭐ Methods, safety, idempotency, and status codes used correctly
- [ ] Headers that matter: `Content-Type`, `Accept`, `Authorization`, `Location`, `Retry-After`
- [ ] HTTP/1.1 vs HTTP/2 vs HTTP/3: multiplexing, head-of-line blocking, QUIC
- [ ] ⭐ HTTPS and TLS: certificates, HSTS, and redirects
- [ ] ⭐ Cookies done right: `HttpOnly`, `Secure`, `SameSite`, `Path`, `__Host-` prefix
- [ ] ⭐ CORS: simple vs preflighted requests, credentials, and common misconfigurations
- [ ] ⭐ HTTP caching: `Cache-Control`, `ETag`, conditional requests, CDNs
- [ ] Compression and content negotiation: Brotli, gzip, zstd, `Vary`
- [ ] Proxies and load balancers: `X-Forwarded-*`, `Forwarded`, Express `trust proxy`
- [ ] ⭐ Timeouts and keep-alive that line up across client, load balancer, and server
- [ ] Debugging with curl and the DevTools Network panel
- [ ] Real-time options: polling, Server-Sent Events, WebSockets

### 03 · Testing
[modules/01-foundations/03-testing](modules/01-foundations/03-testing) · Vitest 4, Supertest, TypeScript · [cheatsheet](modules/01-foundations/03-testing/docs/cheatsheet.md)
- [ ] ⭐ Why we test, and the shape of a suite: unit, integration, end-to-end
- [ ] ⭐ Good tests: Arrange-Act-Assert, one behavior per test, clear names
- [ ] Vitest basics: `describe`, `it`, `expect`, matchers, `test.each`, watch mode
- [ ] ⭐ Test doubles: stubs, spies, mocks, fakes, and when not to mock
- [ ] Mocking modules, time, and randomness: `vi.mock`, `vi.spyOn`, fake timers
- [ ] ⭐ Testing async code, errors, and edge cases
- [ ] ⭐ HTTP integration tests with Supertest against the Express app
- [ ] ⭐ Real databases in tests with Testcontainers; isolation and cleanup
- [ ] Fixtures, factories, and test data builders
- [ ] Coverage: what it measures, thresholds, and why 100% is not the goal
- [ ] Flaky tests: causes, quarantine, and fixes
- [ ] Test-driven development and testing legacy code (characterization tests)
- [ ] Tests in CI: fast feedback, sharding, and reports

### 04 · CI/CD
[modules/01-foundations/04-ci-cd](modules/01-foundations/04-ci-cd) · GitHub Actions, pnpm, Docker · [cheatsheet](modules/01-foundations/04-ci-cd/docs/cheatsheet.md)
- [ ] ⭐ CI vs continuous delivery vs continuous deployment, and what a pipeline is for
- [ ] ⭐ GitHub Actions anatomy: workflows, triggers, jobs, steps, runners
- [ ] ⭐ A fast PR pipeline: install, typecheck, lint, test, build, with caching
- [ ] pnpm in CI: `--frozen-lockfile`, store caching, `pnpm/action-setup`
- [ ] Matrix builds, job dependencies (`needs`), and concurrency groups
- [ ] ⭐ Secrets, variables, and OIDC instead of long-lived cloud keys
- [ ] ⭐ Hardened workflows: least-privilege `permissions`, SHA-pinned actions, no script injection
- [ ] Building and pushing Docker images in CI: Buildx, layer cache, SHA tags, provenance
- [ ] Reusable workflows and composite actions
- [ ] ⭐ Required checks, merge queue, and keeping main green
- [ ] Environments, approvals, and promotion: preview → staging → production
- [ ] Pipeline speed and cost: caching, path filters, cancel-in-progress, artifacts

### 05 · Code Quality & Tooling
[modules/01-foundations/05-code-quality](modules/01-foundations/05-code-quality) · ESLint, typescript-eslint, Prettier, TypeScript 6 (strict) · [cheatsheet](modules/01-foundations/05-code-quality/docs/cheatsheet.md)
- [ ] ⭐ Why tooling: consistent code, fewer bugs, faster reviews
- [ ] ⭐ TypeScript strict mode: what each strict flag catches, and the extra flags worth adding
- [ ] Type-safe boundaries: `unknown`, narrowing, `satisfies`, runtime validation at the edges
- [ ] ⭐ ESLint flat config with typescript-eslint type-aware rules
- [ ] ⭐ Rules that prevent real bugs: floating promises, misused promises, exhaustive switches, unsafe `any`
- [ ] ⭐ Prettier for formatting, kept separate from linting
- [ ] Editor setup: format on save, ESLint in the editor, `.editorconfig`
- [ ] Fast pre-commit checks with plain Git hooks
- [ ] ⭐ Quality gates in CI: typecheck, lint, and format check with zero warnings
- [ ] Code review standards: naming, small functions, comments that explain why
- [ ] Dead code and dependency hygiene: unused code, exports, and packages
- [ ] Managing tech debt: suppressions with reasons, baselines, gradual strictness, codemods

### 06 · Security Fundamentals
[modules/01-foundations/06-security](modules/01-foundations/06-security) · Node.js 26, Express 5, Helmet, express-rate-limit, Dependabot, CodeQL, gitleaks · [cheatsheet](modules/01-foundations/06-security/docs/cheatsheet.md)
- [ ] ⭐ Threat modeling basics: assets, trust boundaries, STRIDE
- [ ] ⭐ OWASP Top 10:2025 mapped to a Node and Express stack
- [ ] ⭐ Injection: SQL, NoSQL, and command injection; parameterized queries
- [ ] ⭐ Broken access control: deny by default, object-level checks (IDOR), mass assignment
- [ ] XSS and output encoding; Content Security Policy basics
- [ ] CSRF: `SameSite`, `Origin` checks, and tokens
- [ ] ⭐ Security headers with Helmet
- [ ] ⭐ Rate limiting and brute-force protection with express-rate-limit
- [ ] SSRF, path traversal, and file upload pitfalls
- [ ] ⭐ Secrets: storage, rotation, and scanning with gitleaks
- [ ] ⭐ Supply chain: lockfiles, Dependabot, `pnpm audit`, install scripts
- [ ] Static analysis with CodeQL and security-focused code review
- [ ] Security logging, least privilege, and handling a vulnerability report

### 07 · Config & Environments
[modules/01-foundations/07-config-environments](modules/01-foundations/07-config-environments) · Node.js 26 (--env-file), Zod 4, Docker Compose · [cheatsheet](modules/01-foundations/07-config-environments/docs/cheatsheet.md)
- [ ] ⭐ Twelve-factor config: config in the environment, one build for every environment
- [ ] ⭐ Environments: local, test, preview, staging, production, and parity between them
- [ ] ⭐ Loading env vars in Node 26: `--env-file`, `--env-file-if-exists`, `process.loadEnvFile`
- [ ] ⭐ Validating config at startup with Zod and failing fast with clear errors
- [ ] Typed config object in one module; no `process.env` scattered through the code
- [ ] `.env` files, `.env.example`, and what never goes in them
- [ ] Secrets vs config: secret managers, runtime injection, rotation without downtime
- [ ] Docker Compose for local environments: services, healthchecks, profiles, overrides
- [ ] Feature flags and runtime config vs build-time config
- [ ] Frontend config: public vs private values, build-time inlining (`VITE_`, `NEXT_PUBLIC_`)
- [ ] Changing config safely: defaults, deprecations, reviews, and audit trails

### 08 · Documentation
[modules/01-foundations/08-documentation](modules/01-foundations/08-documentation) · Markdown, OpenAPI 3.1 (from Zod), Scalar · [cheatsheet](modules/01-foundations/08-documentation/docs/cheatsheet.md)
- [ ] ⭐ Why documentation matters, and the four kinds: tutorials, how-to guides, reference, explanation
- [ ] ⭐ A README that gets a new developer running in 15 minutes
- [ ] Markdown done well: structure, relative links, tables, alerts, Mermaid diagrams
- [ ] ⭐ Architecture Decision Records (ADRs)
- [ ] ⭐ API reference with OpenAPI 3.1 generated from Zod schemas
- [ ] Serving interactive API docs with Scalar
- [ ] Documenting errors, auth, pagination, idempotency, and deprecations in the API reference
- [ ] Runbooks: alerts mapped to actions, deploy and rollback steps, escalation
- [ ] Code comments and TSDoc: comment why, document public APIs
- [ ] CHANGELOG and release notes
- [ ] Keeping docs current: docs as code, review in PRs, CI checks for links and generated files

## 02 · Frontend

### 01 · HTML
[modules/02-frontend/01-html](modules/02-frontend/01-html) · HTML · [cheatsheet](modules/02-frontend/01-html/docs/cheatsheet.md)
- [ ] ⭐ Semantic HTML: landmarks, headings, and choosing the right element
- [ ] Document essentials: doctype, `lang`, charset, viewport, title, description
- [ ] ⭐ Links vs buttons, and native interactive elements: `<details>`, `<dialog>`, popover, `inert`
- [ ] ⭐ Forms in plain HTML: labels, input types, `autocomplete`, built-in validation
- [ ] ⭐ Images and media: `alt`, `srcset`/`sizes`, `<picture>`, `loading`, `width`/`height`, captions
- [ ] Tables for tabular data: `<caption>`, `<th>`, `scope`
- [ ] Loading order and resource hints: `defer`/`async`/`type="module"`, `preload`, `preconnect`, `fetchpriority`
- [ ] Metadata for search and sharing: canonical, robots, Open Graph, JSON-LD
- [ ] Progressive enhancement: HTML that works before JavaScript
- [ ] Validating HTML and inspecting the accessibility tree

### 02 · CSS
[modules/02-frontend/02-css](modules/02-frontend/02-css) · CSS, then Tailwind CSS 4 · [cheatsheet](modules/02-frontend/02-css/docs/cheatsheet.md)
- [ ] ⭐ The cascade, specificity, inheritance, and cascade layers (`@layer`)
- [ ] ⭐ Box model, `box-sizing`, logical properties, and units (`rem`, `ch`, `dvh`, `clamp()`)
- [ ] ⭐ Flexbox and Grid: when to use which; `gap`, `minmax`, `auto-fit`, subgrid
- [ ] ⭐ Responsive design: mobile-first media queries, container queries, fluid type
- [ ] Modern selectors: `:has()`, `:is()`, `:where()`, `:focus-visible`, native nesting
- [ ] Custom properties and color: design tokens, `light-dark()`, `color-mix()`, `oklch()`
- [ ] Positioning, stacking contexts, and `z-index` that doesn't spiral
- [ ] Transitions, animations, `prefers-reduced-motion`, `@starting-style`, view transitions
- [ ] ⭐ Tailwind CSS 4: utility-first, `@theme` tokens, variants, and when to extract components
- [ ] CSS architecture at scale: layers, scoping, naming, avoiding specificity wars
- [ ] CSS performance: render-blocking CSS, `content-visibility`, cheap animations

### 03 · JavaScript
[modules/02-frontend/03-javascript](modules/02-frontend/03-javascript) · JavaScript, TypeScript · [cheatsheet](modules/02-frontend/03-javascript/docs/cheatsheet.md)
- [ ] ⭐ Values, references, and equality: primitives vs objects, `===`, `Object.is`, `structuredClone`
- [ ] ⭐ Scope, closures, and `this`
- [ ] ⭐ The event loop: call stack, microtasks, tasks, and rendering
- [ ] ⭐ Promises and async/await: error handling, `Promise.all`/`allSettled`/`any`/`race`, `AbortController`
- [ ] Modules: ESM imports and exports, dynamic `import()`, top-level await
- [ ] Modern syntax and built-ins: destructuring, `?.`, `??`, `Object.groupBy`, `toSorted`, iterator helpers, Set methods
- [ ] Errors: `Error` subclasses, `cause`, `AggregateError`, and where to catch
- [ ] The DOM and events: delegation, listener options, `AbortSignal` cleanup, custom events
- [ ] Browser APIs: `fetch`, `URL`/`URLSearchParams`, storage, observers
- [ ] Dates, numbers, and text: `Intl`, Temporal, floating-point money pitfalls
- [ ] ⭐ TypeScript for app code: inference, unions, narrowing, generics, utility types
- [ ] Memory and performance basics: leaks from listeners and timers, debouncing and throttling

### 04 · Framework (React / Vue / Angular / Svelte)
[modules/02-frontend/04-framework](modules/02-frontend/04-framework) · React 19.2, TypeScript, Vite 8 · [cheatsheet](modules/02-frontend/04-framework/docs/cheatsheet.md)
- [ ] ⭐ React's model: UI as a function of state, components, JSX, rendering and re-rendering
- [ ] ⭐ Props, state, and lifting state up; one source of truth; derived values
- [ ] ⭐ Effects: when you need them, cleanup, and when you don't
- [ ] Core hooks and their rules: `useState`, `useReducer`, `useRef`, `useContext`, `useId`, `useSyncExternalStore`
- [ ] Lists, keys, and conditional rendering
- [ ] ⭐ Composition: children, slots, compound components, custom hooks
- [ ] React 19 Actions: `useActionState`, `useFormStatus`, `useOptimistic`, `use`, ref as a prop
- [ ] React 19.2: `<Activity>` and `useEffectEvent`
- [ ] Transitions and Suspense: `useTransition`, `useDeferredValue`, `<Suspense>`, `lazy`
- [ ] ⭐ React Compiler and memoization: when `memo`/`useMemo`/`useCallback` still matter
- [ ] Error boundaries and root error callbacks
- [ ] ⭐ Vite 8 project setup: TypeScript, env vars, aliases, dev proxy, build and preview
- [ ] Project structure: feature folders, colocation, avoiding prop drilling

### 05 · State Management
[modules/02-frontend/05-state-management](modules/02-frontend/05-state-management) · React 19.2, TanStack Query 5 · [cheatsheet](modules/02-frontend/05-state-management/docs/cheatsheet.md)
- [ ] ⭐ Kinds of state: server, URL, form, client UI, and derived; where each belongs
- [ ] ⭐ Server state with TanStack Query: `useQuery`, query keys, `staleTime` vs `gcTime`
- [ ] ⭐ Mutations and cache updates: `useMutation`, invalidation, `setQueryData`
- [ ] Optimistic updates and rollback
- [ ] Pagination and infinite queries
- [ ] Dependent and parallel queries, `select`, `placeholderData`
- [ ] Prefetching and `queryOptions` factories
- [ ] Client state: `useState`, `useReducer`, context, and when a store library is worth it
- [ ] URL as state: search params for filters, sorting, and pagination
- [ ] Error and retry policies, refetch on focus and reconnect, network mode
- [ ] Devtools and debugging cache behavior

### 06 · Rendering Strategies
[modules/02-frontend/06-rendering](modules/02-frontend/06-rendering) · Next.js 16, React 19.2 · [cheatsheet](modules/02-frontend/06-rendering/docs/cheatsheet.md)
- [ ] ⭐ Rendering strategies: CSR, SSR, SSG, ISR, streaming, and partial prerendering; their trade-offs
- [ ] ⭐ Next.js App Router: layouts, pages, route groups, dynamic segments, `loading`/`error`/`not-found`
- [ ] ⭐ Server Components vs Client Components; placing the `'use client'` boundary
- [ ] ⭐ Data fetching in Server Components: calling the Express API, forwarding auth, deduplication
- [ ] ⭐ Caching in Next.js 16: Cache Components, `'use cache'`, `cacheLife`, `cacheTag`, `revalidateTag`/`updateTag`
- [ ] Streaming with Suspense and `loading.tsx`
- [ ] Server Functions (Server Actions): mutations, `'use server'`, and their security
- [ ] Static vs dynamic rendering: what makes a component request-specific
- [ ] Hydration and hydration errors
- [ ] Route handlers and `proxy.ts` (formerly middleware)
- [ ] Metadata API and SEO in Next.js
- [ ] Self-hosting Next.js: `output: 'standalone'`, Docker, and caching across instances

### 07 · Performance
[modules/02-frontend/07-performance](modules/02-frontend/07-performance) · React 19.2, Next.js 16, Vite 8, Lighthouse · [cheatsheet](modules/02-frontend/07-performance/docs/cheatsheet.md)
- [ ] ⭐ Core Web Vitals: LCP, INP, CLS; thresholds; lab vs field data
- [ ] ⭐ Measuring: Lighthouse, the DevTools Performance panel, `web-vitals` RUM, CrUX
- [ ] ⭐ The loading path: TTFB, render-blocking resources, resource hints, priorities
- [ ] ⭐ JavaScript cost: bundle analysis, code splitting, tree shaking, dynamic import
- [ ] Images: modern formats, responsive sizes, `next/image`, lazy loading, `fetchpriority`
- [ ] Fonts: `next/font`, `font-display`, subsetting, fallback metrics
- [ ] React rendering performance: unnecessary renders, React Compiler, virtualization
- [ ] INP: long tasks, yielding, transitions, and expensive event handlers
- [ ] CLS: reserved space, `aspect-ratio`, late-loading content and fonts
- [ ] Caching and CDNs for frontend assets
- [ ] Performance budgets and regression tracking in CI (Lighthouse CI)
- [ ] Third-party scripts: cost and containment (`next/script`, facades)

### 08 · Accessibility
[modules/02-frontend/08-accessibility](modules/02-frontend/08-accessibility) · HTML, React 19.2, axe-core, Playwright · [cheatsheet](modules/02-frontend/08-accessibility/docs/cheatsheet.md)
- [ ] ⭐ Why accessibility: users, law (European Accessibility Act, ADA), WCAG 2.2 AA
- [ ] ⭐ Semantic HTML first; the accessibility tree; roles, names, and states
- [ ] ⭐ Keyboard access: focus order, visible focus, skip links, no traps
- [ ] ⭐ Accessible forms: labels, errors, descriptions, required fields
- [ ] ARIA: the rules of ARIA use, common attributes, live regions; when not to use ARIA
- [ ] Focus management in single-page apps: route changes, dialogs, `inert`
- [ ] Color, contrast, zoom and reflow, reduced motion
- [ ] Images, icons, and media: alt text, decorative images, captions
- [ ] Accessible custom components: dialog, menu, tabs, combobox (APG patterns)
- [ ] ⭐ Automated testing with axe-core and Playwright
- [ ] Manual testing: keyboard pass, screen readers (NVDA, VoiceOver), zoom to 400%
- [ ] Accessibility in the process: Definition of Done, design reviews, accessibility statements

### 09 · UX States & Error Handling
[modules/02-frontend/09-ux-states](modules/02-frontend/09-ux-states) · React 19.2, TanStack Query 5, Tailwind CSS 4 · [cheatsheet](modules/02-frontend/09-ux-states/docs/cheatsheet.md)
- [ ] ⭐ Every screen has states: loading, empty, error, partial, success, offline
- [ ] ⭐ Loading UX: skeletons vs spinners, avoiding flicker, `isPending` vs `isFetching`
- [ ] ⭐ Error handling in the UI: error boundaries, query errors, retries, helpful messages
- [ ] Empty states that help the user act
- [ ] Optimistic UI and undo instead of confirm dialogs
- [ ] Feedback: toasts, inline messages, and accessible status announcements
- [ ] Offline and slow networks: cached data, stale indicators, paused mutations
- [ ] Suspense-based loading with `useSuspenseQuery` and where to place boundaries
- [ ] Destructive actions: confirmations, undo, and preventing double submits
- [ ] Reporting UI errors with context (Sentry)

### 10 · Forms & Validation
[modules/02-frontend/10-forms](modules/02-frontend/10-forms) · React Hook Form 7, Zod 4, React 19.2 · [cheatsheet](modules/02-frontend/10-forms/docs/cheatsheet.md)
- [ ] ⭐ Form fundamentals: controlled vs uncontrolled inputs, native validation, `<form action>` in React 19
- [ ] ⭐ React Hook Form: `useForm`, `register`, `handleSubmit`, `formState`
- [ ] ⭐ Zod schemas with `zodResolver`; one schema shared by the form and the Express API
- [ ] Field arrays and dynamic fields with `useFieldArray`
- [ ] Controlled third-party inputs with `Controller`
- [ ] ⭐ Server errors: mapping API validation errors to fields with `setError`
- [ ] ⭐ Accessible forms: labels, error messages, focus on the first error
- [ ] Submission UX: pending state, double-submit prevention, success handling
- [ ] Multi-step forms and draft persistence
- [ ] File inputs and uploads with progress
- [ ] Testing forms with Testing Library, `user-event`, and MSW

### 11 · Frontend Security
[modules/02-frontend/11-security](modules/02-frontend/11-security) · React 19.2, Next.js 16, CSP · [cheatsheet](modules/02-frontend/11-security/docs/cheatsheet.md)
- [ ] ⭐ The browser threat model: XSS, CSRF, clickjacking, and supply chain in the frontend
- [ ] ⭐ XSS in React: what React escapes, and the escape hatches (`dangerouslySetInnerHTML`, URLs, refs)
- [ ] ⭐ Content Security Policy with nonces in Next.js 16 (`proxy.ts`)
- [ ] Trusted Types and HTML sanitization (DOMPurify)
- [ ] ⭐ Tokens in the browser: `HttpOnly` cookies vs `localStorage`
- [ ] ⭐ Securing Server Actions and route handlers: validation, authentication, authorization, CSRF
- [ ] Data exposure: what reaches the client, `server-only`, DTOs, taint APIs
- [ ] Third-party scripts, Subresource Integrity, and dependency risk
- [ ] Security headers for Next.js: HSTS, `frame-ancestors`, `Permissions-Policy`, `Referrer-Policy`
- [ ] Open redirects and safe navigation
- [ ] Secrets in the frontend: env var prefixes and build-time inlining

### 12 · Cross-Cutting Frontend
[modules/02-frontend/12-cross-cutting](modules/02-frontend/12-cross-cutting) · React 19.2, TypeScript, Tailwind CSS 4 · [cheatsheet](modules/02-frontend/12-cross-cutting/docs/cheatsheet.md)
- [ ] ⭐ Responsive layouts across devices: mobile-first, container queries, touch targets
- [ ] ⭐ Design tokens and a small component library: variants, composition, consistency
- [ ] Theming and dark mode without a flash
- [ ] ⭐ Internationalization: `Intl` APIs, ICU messages, plurals, right-to-left, locale routing
- [ ] Dates, times, numbers, and currencies across time zones
- [ ] ⭐ SEO: metadata, canonical URLs, sitemaps, robots, structured data
- [ ] Feature flags and gradual rollouts in the frontend
- [ ] Analytics and consent: privacy-friendly events and consent that is respected
- [ ] Browser support: Baseline, browserslist, progressive enhancement
- [ ] Icons, images, and fonts as a system
- [ ] Offline and resilience basics: service workers, network status, installable apps

### 13 · Frontend Testing & Monitoring
[modules/02-frontend/13-testing-monitoring](modules/02-frontend/13-testing-monitoring) · Vitest 4, Testing Library, MSW, Playwright, Sentry · [cheatsheet](modules/02-frontend/13-testing-monitoring/docs/cheatsheet.md)
- [ ] ⭐ Frontend testing strategy: what to test where (unit, component, E2E, visual)
- [ ] ⭐ Component tests with Testing Library: role queries, `user-event`, async utilities
- [ ] ⭐ Mocking the network with MSW, shared between tests and development
- [ ] Testing hooks, context, and TanStack Query
- [ ] Vitest browser mode vs jsdom
- [ ] ⭐ End-to-end tests with Playwright: locators, auto-waiting, fixtures, authentication state
- [ ] Visual regression and accessibility-tree snapshots
- [ ] Flaky E2E tests: causes, traces, and fixes
- [ ] ⭐ Error monitoring with Sentry: setup for React and Next.js, source maps, releases
- [ ] Performance and session monitoring: web vitals, tracing, Session Replay with privacy
- [ ] Alerting on frontend errors and a triage workflow
- [ ] Frontend tests in CI: sharding, artifacts, and traces

## 03 · Backend

### 01 · Language & Runtime
[modules/03-backend/01-language-runtime](modules/03-backend/01-language-runtime) · Node.js 26, TypeScript 6 (strict) · [cheatsheet](modules/03-backend/01-language-runtime/docs/cheatsheet.md)
- [ ] ⭐ How Node works: V8, libuv, event loop phases, and the thread pool
- [ ] ⭐ Blocking the event loop: what blocks, how to detect it, and how to fix it
- [ ] ⭐ Async patterns and error handling: promises, unhandled rejections, `AbortSignal`
- [ ] Modules in Node: ESM, CommonJS interop, `require(esm)`, package `exports` and `imports`
- [ ] ⭐ Running TypeScript on Node 26: type stripping, `erasableSyntaxOnly`, and when to compile
- [ ] Streams and backpressure: `pipeline`, Web Streams, large data
- [ ] Built-in modules worth knowing: `fs/promises`, `crypto`, `util`, `AsyncLocalStorage`, `node:test`
- [ ] ⭐ Process lifecycle: signals, graceful shutdown, exit codes, `uncaughtException`
- [ ] Memory: the V8 heap, leaks, heap snapshots, container memory limits
- [ ] Profiling and diagnostics: `--inspect`, CPU profiles, event loop delay, diagnostic reports
- [ ] Node release lines (LTS, Current, EOL) and version management
- [ ] Runtime security: permission model, code-generation limits, keeping Node patched

### 02 · API Design
[modules/03-backend/02-api-design](modules/03-backend/02-api-design) · Express 5, Zod 4, OpenAPI 3.1 · [cheatsheet](modules/03-backend/02-api-design/docs/cheatsheet.md)
- [ ] ⭐ Resource-oriented REST design: nouns, URLs, methods, status codes
- [ ] ⭐ Express 5 app structure: routers, middleware order, async errors, and the error handler
- [ ] ⭐ Request validation with Zod: body, params, query; 400 vs 422
- [ ] ⭐ Consistent error responses with Problem Details (RFC 9457)
- [ ] Pagination: cursor vs offset; filtering and sorting conventions
- [ ] ⭐ Idempotency keys for safe retries of POST
- [ ] Versioning and evolving APIs without breaking clients; deprecation
- [ ] Response shaping: DTOs, field naming, dates, money, nulls
- [ ] Concurrency control: ETags and `If-Match`, optimistic locking
- [ ] Long-running operations: 202 Accepted and status resources
- [ ] API contract and docs with OpenAPI 3.1 generated from Zod
- [ ] Webhooks you send: signatures, retries, and idempotency for consumers
- [ ] REST vs GraphQL vs RPC: when each fits

### 03 · Databases
[modules/03-backend/03-databases](modules/03-backend/03-databases) · PostgreSQL 18, pg, Drizzle ORM, MongoDB 8, Mongoose · [cheatsheet](modules/03-backend/03-databases/docs/cheatsheet.md)
- [ ] ⭐ Relational modeling: normalization, keys, relationships, constraints
- [ ] ⭐ SQL you must know: joins, aggregates, CTEs, window functions, upserts
- [ ] ⭐ Indexes: B-tree, composite, partial, expression, GIN; reading `EXPLAIN ANALYZE`
- [ ] ⭐ Transactions and isolation levels; locking; `SELECT … FOR UPDATE SKIP LOCKED`
- [ ] ⭐ Using `pg` safely: pools, parameterized queries, timeouts, transactions
- [ ] Drizzle ORM: schema in TypeScript, queries, relations, transactions
- [ ] ⭐ Migrations with Drizzle Kit: generate, review, apply; zero-downtime changes
- [ ] Data types: `timestamptz`, money as integer minor units, `uuidv7()`, `jsonb`, `citext`, enums
- [ ] The N+1 problem and how to avoid it
- [ ] Connection management in production: pool sizing, RDS Proxy/PgBouncer, timeouts
- [ ] MongoDB data modeling: embed vs reference, schema design patterns
- [ ] Mongoose: schemas, validation, indexes, `lean()`, transactions, query sanitization
- [ ] Postgres operations basics: VACUUM, autovacuum, bloat, `pg_stat_statements`
- [ ] Choosing Postgres vs MongoDB (and JSONB in between)

### 04 · Authentication & Authorization
[modules/03-backend/04-auth](modules/03-backend/04-auth) · Express 5, Redis 8, argon2, Better Auth · [cheatsheet](modules/03-backend/04-auth/docs/cheatsheet.md)
- [ ] ⭐ Authentication vs authorization; identity, credentials, sessions
- [ ] ⭐ Password storage with argon2id; password rules from NIST SP 800-63B
- [ ] ⭐ Server-side sessions in Redis with secure cookies; rotation and expiry
- [ ] Session fixation, logout everywhere, and listing active sessions
- [ ] ⭐ Login protection: rate limits, throttling vs lockouts, credential stuffing defenses
- [ ] Password reset and email verification with single-use tokens
- [ ] Multi-factor authentication: TOTP, passkeys (WebAuthn), recovery codes
- [ ] ⭐ Authorization: RBAC, ownership checks, permission middleware
- [ ] Sessions vs JWTs: trade-offs, and where JWTs fit
- [ ] OAuth 2.0 / OpenID Connect sign-in: authorization code + PKCE, state, account linking
- [ ] ⭐ Moving to Better Auth: Express setup, database adapter, plugins
- [ ] Auth for several clients: Next.js frontend, mobile apps, API keys
- [ ] Auditing and monitoring authentication events

### 05 · Validation & Abuse Protection
[modules/03-backend/05-validation-abuse](modules/03-backend/05-validation-abuse) · Zod 4, express-rate-limit, Redis 8 · [cheatsheet](modules/03-backend/05-validation-abuse/docs/cheatsheet.md)
- [ ] ⭐ Validate everything at the boundary: body, params, query, headers, files
- [ ] ⭐ Zod in Express: reusable validation helpers, typed requests, coercion
- [ ] Normalization and canonicalization: trimming, case, Unicode, emails, URLs
- [ ] ⭐ Size and complexity limits: body size, arrays, string lengths, page sizes, timeouts
- [ ] ⭐ Rate limiting strategies: per IP, user, API key, and route; algorithms
- [ ] Distributed rate limiting with Redis; `RateLimit` headers and `Retry-After`
- [ ] Bot and abuse protection: credential stuffing, card testing, SMS pumping, signup spam, scraping
- [ ] Mass assignment and over-posting protection
- [ ] Verifying incoming webhooks: raw body, signatures, timestamps, replay protection
- [ ] Business-logic abuse: coupon stacking, race conditions, negative quantities
- [ ] Monitoring abuse: metrics, alerts, blocklists, and response playbooks

### 06 · Caching
[modules/03-backend/06-caching](modules/03-backend/06-caching) · Redis 8 · [cheatsheet](modules/03-backend/06-caching/docs/cheatsheet.md)
- [ ] ⭐ Why and where to cache: browser, CDN, application, database; what not to cache
- [ ] ⭐ Cache-aside with Redis: keys, TTLs, serialization
- [ ] ⭐ Invalidation strategies: TTLs, deletes after writes, versioned keys, tag sets
- [ ] Cache stampede protection: locks, request coalescing, jittered TTLs, stale-while-revalidate
- [ ] Redis data structures for caching: strings, hashes, sets, sorted sets; hash-field expiration
- [ ] Write-through, write-behind, and read-through patterns
- [ ] In-process caches (LRU) vs Redis; two-level caching
- [ ] HTTP caching for APIs: `Cache-Control`, ETags, CDN caching
- [ ] Redis operations: memory limits, eviction policies, persistence, replication; Valkey compatibility
- [ ] Measuring cache effectiveness: hit ratio, latency, memory
- [ ] Caching pitfalls: stale data, leaking personalized data, unbounded keys

### 07 · Background Jobs & Messaging
[modules/03-backend/07-background-jobs](modules/03-backend/07-background-jobs) · BullMQ, Redis 8 · [cheatsheet](modules/03-backend/07-background-jobs/docs/cheatsheet.md)
- [ ] ⭐ Why background jobs: what leaves the request path and why
- [ ] ⭐ BullMQ basics: queues, workers, jobs, connections
- [ ] ⭐ Retries with backoff, attempts, and unrecoverable errors
- [ ] ⭐ Idempotent jobs and the exactly-once illusion
- [ ] Delayed and scheduled jobs: job schedulers, cron patterns, time zones
- [ ] Concurrency, rate limiting, and priorities
- [ ] Flows: parent and child jobs
- [ ] Failed jobs: dead-letter handling, alerting, replaying
- [ ] Graceful shutdown and stalled jobs
- [ ] The transactional outbox pattern
- [ ] Pub/sub and messaging options: Redis pub/sub, Streams, SQS/SNS, Kafka
- [ ] Monitoring queues: depth, oldest-job age, failure rate

### 08 · Reliability & Resilience
[modules/03-backend/08-reliability](modules/03-backend/08-reliability) · Node.js 26, Express 5, BullMQ · [cheatsheet](modules/03-backend/08-reliability/docs/cheatsheet.md)
- [ ] ⭐ Failure modes and designing for failure: slow and failed dependencies, overload, bad deploys
- [ ] ⭐ Timeouts everywhere: HTTP clients, database, Redis, server, request deadlines
- [ ] ⭐ Retries with exponential backoff and jitter; retry budgets; only retry what is safe
- [ ] ⭐ Health checks: liveness, readiness, startup
- [ ] ⭐ Graceful shutdown and zero-downtime deploys: SIGTERM, draining, ECS and ALB settings
- [ ] Circuit breakers and failing fast
- [ ] Bulkheads: isolating pools, queues, and concurrency
- [ ] Load shedding and backpressure: 503, `Retry-After`, bounded queues
- [ ] Graceful degradation and fallbacks: stale data, defaults, kill switches, partial responses
- [ ] SLIs, SLOs, and error budgets; burn-rate alerts
- [ ] Handling dependency outages: database failover, Redis down, third-party APIs
- [ ] Testing failure: fault injection, chaos experiments, game days

### 09 · Scalability & Performance
[modules/03-backend/09-scalability](modules/03-backend/09-scalability) · Node.js 26, PostgreSQL 18, Redis 8, k6 · [cheatsheet](modules/03-backend/09-scalability/docs/cheatsheet.md)
- [ ] ⭐ Measure first: latency percentiles, throughput, saturation, and where the time goes
- [ ] ⭐ Load testing with k6: test types, open vs closed models, thresholds, realistic data
- [ ] ⭐ Stateless services and horizontal scaling; autoscaling on ECS
- [ ] ⭐ Database scaling: query tuning at scale, connection budgets and pooling, read replicas
- [ ] Offloading reads with CDNs, caches, and precomputation
- [ ] Node.js performance: CPU profiling, memory, worker threads, cluster vs containers
- [ ] Partitioning and sharding: Postgres table partitioning, when to shard
- [ ] Queues for throughput: async processing, absorbing spikes, scaling workers
- [ ] Capacity planning: Little's law, utilization headroom, shared limits
- [ ] Payloads and batching: pagination, lean DTOs, compression, bulk endpoints, streaming
- [ ] Scaling real-time connections: SSE and WebSockets with Redis pub/sub
- [ ] Performance budgets and load tests in CI

### 10 · Observability
[modules/03-backend/10-observability](modules/03-backend/10-observability) · Pino, OpenTelemetry, Grafana LGTM, Sentry · [cheatsheet](modules/03-backend/10-observability/docs/cheatsheet.md)
- [ ] ⭐ Logs, metrics, traces, and errors: what each answers; monitoring vs observability
- [ ] ⭐ Structured logging with Pino: levels, context, child loggers, request logging
- [ ] ⭐ Distributed tracing with OpenTelemetry: spans, context propagation, auto-instrumentation
- [ ] ⭐ Metrics with OpenTelemetry: counters, histograms, RED and USE, cardinality
- [ ] Correlating signals: trace IDs in logs, exemplars, linking errors to traces
- [ ] Grafana LGTM: Loki, Grafana, Tempo, Mimir, and the Alloy collector
- [ ] ⭐ Error tracking with Sentry: Express setup, releases, sharing the OpenTelemetry setup
- [ ] Dashboards that help: service overview, dependencies, business panels, dashboards as code
- [ ] Alerting: symptom-based alerts, runbooks, routing, on-call hygiene
- [ ] Sampling and cost control: head vs tail sampling, log volume, cardinality, retention
- [ ] Business and dependency metrics: orders, payments, signups, partner latency
- [ ] Privacy and security in telemetry: redaction, personal data, secrets, access

### 11 · Architecture
[modules/03-backend/11-architecture](modules/03-backend/11-architecture) · Node.js 26, Express 5, TypeScript · [cheatsheet](modules/03-backend/11-architecture/docs/cheatsheet.md)
- [ ] ⭐ What architecture is for: change, teams, trade-offs; start with a modular monolith
- [ ] ⭐ Layers: routes, use cases, domain, repositories; the dependency rule
- [ ] ⭐ Feature modules with public APIs instead of technical-layer folders
- [ ] ⭐ Dependency injection without a framework: composition root, factory functions, fakes in tests
- [ ] Domain logic: business rules out of HTTP and SQL; value objects and invariants
- [ ] Error architecture: domain errors with codes, mapped to HTTP in one place
- [ ] Ports and adapters for external services: payments, email, storage
- [ ] Events between modules: domain events, the outbox, eventual consistency
- [ ] Monolith vs microservices: when to split, costs, the distributed-monolith trap
- [ ] Recording and evolving decisions: ADRs, the strangler fig
- [ ] Transactions and consistency boundaries: unit of work, no network calls inside transactions
- [ ] Enforcing boundaries: ESLint import rules, architecture tests, CODEOWNERS

### 12 · Common Integrations
[modules/03-backend/12-integrations](modules/03-backend/12-integrations) · Stripe, AWS SES, AWS S3, BullMQ · [cheatsheet](modules/03-backend/12-integrations/docs/cheatsheet.md)
- [ ] ⭐ Integration principles: adapters, timeouts, retries, idempotency, secrets, sandboxes
- [ ] ⭐ Payments with Stripe: PaymentIntents, Checkout vs Payment Element, amounts in minor units, test mode
- [ ] ⭐ Stripe webhooks: raw-body signature verification, idempotent handlers, ordering, retries
- [ ] ⭐ Transactional email with AWS SES: domain identity, SPF, DKIM, DMARC, leaving the sandbox
- [ ] Email deliverability: bounces, complaints, suppression lists, event destinations
- [ ] ⭐ Uploads to S3 with presigned URLs: size and type limits, private buckets, key design
- [ ] Serving files: presigned GETs, CloudFront with origin access control, caching
- [ ] Upload security: validation, magic bytes, malware scanning, quarantine
- [ ] Sending webhooks to customers: signing, retries with BullMQ, delivery logs, SSRF protection
- [ ] Third-party API clients: rate limits, pagination, SDK vs raw HTTP
- [ ] Testing integrations: Stripe CLI and test cards, SES mailbox simulator, fakes, contract tests
- [ ] Reconciliation and monitoring: reconciliation jobs, dashboards, alerts per integration

## 04 · Shipping

### 01 · Containers
[modules/04-shipping/01-containers](modules/04-shipping/01-containers) · Docker, Docker Compose · [cheatsheet](modules/04-shipping/01-containers/docs/cheatsheet.md)
- [ ] ⭐ Containers vs VMs: images, layers, containers, registries
- [ ] ⭐ Production Dockerfiles for Node.js: multi-stage builds, slim base images, non-root user
- [ ] ⭐ Layer caching and build speed: instruction order, `.dockerignore`, BuildKit cache mounts
- [ ] ⭐ Image security: minimal and pinned bases, scanning, no secrets in images, SBOMs
- [ ] Runtime configuration: environment variables, runtime secrets, signals and PID 1, memory limits
- [ ] Docker Compose for local development: healthchecks, ordered startup, volumes, profiles, watch
- [ ] Next.js in containers: standalone output, static assets, multiple instances
- [ ] Multi-architecture images: amd64 and arm64, Graviton, native builds
- [ ] Tags, registries, and retention: immutable SHA tags, digests, ECR lifecycle policies
- [ ] Debugging containers: logs, exec, inspect, exit codes, resource limits

### 02 · Cloud
[modules/04-shipping/02-cloud](modules/04-shipping/02-cloud) · AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas · [cheatsheet](modules/04-shipping/02-cloud/docs/cheatsheet.md)
- [ ] ⭐ AWS foundations: an account per environment, Organizations, IAM Identity Center for people
- [ ] ⭐ IAM: roles instead of keys, least privilege, task roles vs execution roles
- [ ] ⭐ Networking: VPC, public and private subnets, security groups, NAT, VPC endpoints
- [ ] ⭐ Running containers on ECS Fargate: task definitions, services, Graviton, Fargate Spot
- [ ] RDS for PostgreSQL in production: Multi-AZ, roles, TLS, parameter groups, protection
- [ ] ElastiCache (Valkey): replication, failover, encryption, separate cache and queue clusters
- [ ] S3 and CloudFront: private buckets, origin access control, static assets
- [ ] Secrets and configuration: Secrets Manager, Parameter Store, injecting into tasks, rotation
- [ ] DNS and TLS: Route 53 aliases, ACM certificates, ALB listeners and rules
- [ ] MongoDB Atlas: tiers, region, PrivateLink, users, backups
- [ ] Cost awareness: what costs money, budgets, anomaly detection, Graviton, Spot, Savings Plans
- [ ] Platform logs and metrics: CloudWatch Logs retention, Container Insights, alarms

### 03 · Infrastructure as Code
[modules/04-shipping/03-iac](modules/04-shipping/03-iac) · Terraform · [cheatsheet](modules/04-shipping/03-iac/docs/cheatsheet.md)
- [ ] ⭐ Why infrastructure as code: reviewable, repeatable, recoverable, drift visible
- [ ] ⭐ Terraform basics: providers, resources, data sources, variables, outputs, locals, `for_each`
- [ ] ⭐ State: remote state in S3 with native locking, protecting state, never editing it by hand
- [ ] ⭐ The plan and apply workflow: plans in PRs, applies from CI, reading plans
- [ ] Modules: structure, typed inputs, outputs, versioning, community modules
- [ ] Environments: directory and account per environment, provider roles, default tags
- [ ] Secrets and state: managed passwords, ephemeral resources, write-only arguments
- [ ] Refactoring safely: `moved`, `import`, and `removed` blocks
- [ ] Guardrails and drift: `prevent_destroy`, `check` blocks, policy scans, nightly drift plans
- [ ] Terraform in CI with GitHub Actions and OIDC: plan and apply roles, approvals
- [ ] Keeping the OpenTofu exit open: the compatible feature subset
- [ ] Testing infrastructure code: `terraform test` with mock providers, integration tests

### 04 · Deployments
[modules/04-shipping/04-deployments](modules/04-shipping/04-deployments) · GitHub Actions, Docker, AWS ECS · [cheatsheet](modules/04-shipping/04-deployments/docs/cheatsheet.md)
- [ ] ⭐ The deployment pipeline: build once, promote the same image through environments
- [ ] ⭐ Authenticating to AWS from GitHub Actions with OIDC
- [ ] ⭐ Building and pushing images to ECR with immutable tags and digests
- [ ] ⭐ Deploying to ECS: new task definition revision, service update, waiting for stability
- [ ] Rolling deployments, the deployment circuit breaker, alarm-based rollback
- [ ] Blue/green, canary, and linear deployments
- [ ] Database migrations in the pipeline: one-off tasks, locks, expand/contract
- [ ] Environments and approvals: GitHub environments, protection rules, production gates
- [ ] Feature flags: separating deploy from release, rollouts, kill switches, cleanup
- [ ] Rollbacks: previous revisions, redeploying old images, when migrations block rollback
- [ ] Deploying the Next.js frontend: static assets on S3/CloudFront, version skew, shared keys
- [ ] Release hygiene: versions, changelogs, deploy markers, DORA metrics

### 05 · Data Safety
[modules/04-shipping/05-data-safety](modules/04-shipping/05-data-safety) · PostgreSQL 18, AWS RDS backups, Drizzle Kit migrations, MongoDB Atlas backups · [cheatsheet](modules/04-shipping/05-data-safety/docs/cheatsheet.md)
- [ ] ⭐ RPO and RTO: how much data you can lose and how fast you must recover
- [ ] ⭐ RDS automated backups, point-in-time recovery, and manual snapshots
- [ ] ⭐ Restore drills: restoring regularly, checking the data, measuring the real RTO
- [ ] ⭐ Safe migrations in production: lock timeouts, concurrent indexes, expand/contract, batched backfills
- [ ] Logical backups with `pg_dump` and `pg_restore`: when and how
- [ ] Backup copies and immutability: cross-account and cross-region copies, AWS Backup vault lock
- [ ] Protecting against human error: deletion protection, `prevent_destroy`, SCPs, least privilege, soft deletes
- [ ] Data retention and deletion: retention schedules, GDPR erasure, backups that contain deleted data
- [ ] MongoDB Atlas backups: continuous cloud backup, point-in-time restore, `mongodump`
- [ ] Disaster recovery strategies: backup and restore, pilot light, warm standby, active/active
- [ ] Encryption at rest and in transit; KMS key management
- [ ] Non-production data: synthetic seeds and anonymized copies, never raw production data

### 06 · Incident Response
[modules/04-shipping/06-incident-response](modules/04-shipping/06-incident-response) · Sentry, Grafana, OpenTelemetry · [cheatsheet](modules/04-shipping/06-incident-response/docs/cheatsheet.md)
- [ ] ⭐ What an incident is: severity levels and declaring early
- [ ] ⭐ Roles: incident commander, operations, communications; one incident channel
- [ ] ⭐ Mitigation first: rollback, flags, scaling, failover before root cause
- [ ] ⭐ Debugging in production with telemetry: dashboards, traces, logs, Sentry, deploy markers
- [ ] Communication: status page, customer and internal updates on a schedule
- [ ] On-call: rotations, escalation, alert quality, sustainable load
- [ ] Runbooks: structure, linking from alerts, keeping them current
- [ ] Blameless postmortems: timeline, contributing factors, owned action items
- [ ] Common incident patterns and their first moves
- [ ] Practicing: tabletops, game days, fault injection, restore drills
- [ ] Security incidents: evidence, containment, legal notification deadlines
- [ ] Measuring and improving: time to detect and mitigate, customer-detected incidents, follow-through

## 05 · Practice

### 01 · Engineering Practice
[modules/05-practice/01-engineering-practice](modules/05-practice/01-engineering-practice) · Git, GitHub · [cheatsheet](modules/05-practice/01-engineering-practice/docs/cheatsheet.md)
- [ ] ⭐ Working in small batches: vertical slices, small PRs, merging daily, flags for unfinished work
- [ ] ⭐ Code review as a reviewer: priorities, turnaround, labeled and kind comments
- [ ] ⭐ Code review as an author: self-review, descriptions, responding to feedback
- [ ] ⭐ Writing tickets and breaking down work: acceptance criteria, out of scope, definition of done, spikes
- [ ] Estimation and delivery: ranges, unknowns, milestones, scope negotiation
- [ ] Technical debt: making it visible, paying it down in the flow of work, safe refactoring
- [ ] Design docs and RFCs: when to write one, structure, early feedback, ADRs
- [ ] Communication: bottom line up front, escalating early, async updates, good questions
- [ ] Debugging methodically: reproduce, hypothesize, narrow with `git bisect`, test the fix
- [ ] Working with AI coding assistants responsibly: review, verification, tests, security, data policy
- [ ] Ownership: done means working in production, watching deploys, readiness checklists
- [ ] Growing from mid-level to senior: scope, impact, mentoring, feedback

## 06 · Software Design & Architecture

### 01 · Paradigms & OOP
[modules/06-design/01-paradigms-oop](modules/06-design/01-paradigms-oop) · TypeScript 6 (strict) · [cheatsheet](modules/06-design/01-paradigms-oop/docs/cheatsheet.md)
- [ ] ⭐ Programming paradigms: imperative, procedural, object-oriented, functional, declarative, reactive; mixing them in TypeScript
- [ ] ⭐ The four OOP pillars: encapsulation, abstraction, inheritance, polymorphism
- [ ] ⭐ Composition over inheritance; interfaces vs abstract classes; mixins
- [ ] Classes in TypeScript: `#private`, `readonly`, `static`, accessors, and the erasable-syntax limits
- [ ] ⭐ Functional programming essentials: pure functions, immutability, higher-order functions, closures, composition
- [ ] Algebraic data types: discriminated unions, exhaustive matching, `Result` and option types
- [ ] Polymorphism without classes: structural typing, generics, dispatch tables
- [ ] Entities, value objects, and DTOs: identity, equality, immutability
- [ ] Error handling styles: exceptions vs result types
- [ ] Choosing a style: functional core, imperative shell; when classes help

### 02 · Design Principles & SOLID
[modules/06-design/02-principles](modules/06-design/02-principles) · TypeScript 6 (strict) · [cheatsheet](modules/06-design/02-principles/docs/cheatsheet.md)
- [ ] ⭐ Coupling and cohesion: the two measures behind most principles
- [ ] ⭐ Single Responsibility Principle: one reason to change
- [ ] ⭐ Open/Closed Principle: extend by adding code, not editing it
- [ ] Liskov Substitution Principle: implementations keep the contract
- [ ] Interface Segregation Principle: small, client-specific interfaces
- [ ] ⭐ Dependency Inversion Principle: abstractions owned by the core
- [ ] ⭐ DRY, KISS, YAGNI, and when they conflict
- [ ] Law of Demeter, tell don't ask, command–query separation
- [ ] Separation of concerns, information hiding, policy vs detail
- [ ] Code smells and refactorings; refactoring safely with tests
- [ ] Principles in code review: concrete comments, spotting over-engineering

### 03 · Design Patterns
[modules/06-design/03-design-patterns](modules/06-design/03-design-patterns) · TypeScript 6 (strict), Node.js 26 · [cheatsheet](modules/06-design/03-design-patterns/docs/cheatsheet.md)
- [ ] ⭐ What patterns are for: vocabulary, forces, trade-offs; patterns in modern TypeScript
- [ ] ⭐ Creational patterns: factory function, factory method, abstract factory, builder; singleton and its risks
- [ ] Dependency injection and the composition root as the modern creational pattern
- [ ] ⭐ Structural patterns: adapter, facade, decorator, proxy
- [ ] Structural patterns: composite, bridge, flyweight
- [ ] ⭐ Behavioral patterns: strategy, observer, command
- [ ] Behavioral patterns: state, template method, chain of responsibility, iterator, mediator, visitor
- [ ] ⭐ Application patterns: repository, unit of work, data mapper vs active record, specification
- [ ] Resilience and integration patterns: retry, circuit breaker, bulkhead, outbox, saga, anti-corruption layer
- [ ] Frontend patterns: container/presentational, custom hooks, composition, compound components, providers
- [ ] Anti-patterns: god object, service locator, singleton abuse, pattern-itis, big ball of mud
- [ ] Choosing a pattern: problem first, simplest thing, refactoring towards and away from patterns

### 04 · Architecture Styles
[modules/06-design/04-architecture-styles](modules/06-design/04-architecture-styles) · TypeScript, Express 5, Next.js 16, React 19.2 · [cheatsheet](modules/06-design/04-architecture-styles/docs/cheatsheet.md)
- [ ] ⭐ What architecture styles solve: forces, quality attributes, trade-offs
- [ ] ⭐ Layered and n-tier: logical layers vs physical tiers
- [ ] UI patterns: MVC, MVP, MVVM, component-based; how React and Next.js map to them
- [ ] ⭐ Clean, hexagonal (ports and adapters), and onion architecture: the dependency rule
- [ ] Vertical slice architecture and feature modules
- [ ] ⭐ Modular monolith
- [ ] ⭐ Microservices: benefits, costs, data ownership, when to split
- [ ] Event-driven architecture: events, choreography vs orchestration, event-carried state
- [ ] CQRS and event sourcing as architecture choices
- [ ] Serverless, backend for frontend, and API gateways
- [ ] Quality attributes, fitness functions, and architecture decision records
- [ ] Combining styles: n-tier, modular monolith, clean architecture, and DDD in one system

### 05 · Domain-Driven Design
[modules/06-design/05-domain-driven-design](modules/06-design/05-domain-driven-design) · TypeScript, Node.js 26, Drizzle ORM, PostgreSQL 18 · [cheatsheet](modules/06-design/05-domain-driven-design/docs/cheatsheet.md)
- [ ] ⭐ Why DDD: complex domains, models, and the cost of misunderstanding
- [ ] ⭐ Ubiquitous language and domain experts; event storming
- [ ] Subdomains: core, supporting, generic; build vs buy
- [ ] ⭐ Bounded contexts and context maps: ACL, shared kernel, customer–supplier, conformist, open host, published language
- [ ] ⭐ Entities and value objects
- [ ] ⭐ Aggregates: invariants, consistency boundaries, references by ID, size
- [ ] Domain events and integration events
- [ ] Repositories, factories, domain services, and application services
- [ ] Modeling in TypeScript: branded types, smart constructors, parse don't validate, illegal states unrepresentable
- [ ] Persisting aggregates with Drizzle: data mapping, optimistic concurrency, events through the outbox
- [ ] ⭐ DDD with clean/hexagonal architecture: where each building block lives
- [ ] When not to use DDD: CRUD, generic subdomains, prototypes, DDD-lite

### 06 · System Design
[modules/06-design/06-system-design](modules/06-design/06-system-design) · PostgreSQL 18, Redis 8, BullMQ, AWS · [cheatsheet](modules/06-design/06-system-design/docs/cheatsheet.md)
- [ ] ⭐ The system design method: requirements, estimates, API, data, high-level design, deep dives, trade-offs
- [ ] ⭐ Back-of-the-envelope estimation: latency numbers, QPS, storage, bandwidth
- [ ] ⭐ Building blocks: load balancers, API gateways, caches, CDNs, queues, object storage, search
- [ ] Data storage choices: relational, document, key-value, wide-column, search, time-series, object
- [ ] Scaling data: replication, partitioning and sharding, consistent hashing, hot keys
- [ ] Caching strategies at system level
- [ ] Asynchronous processing: queues, streams, fan-out, backpressure
- [ ] Rate limiting, idempotency, and API design at scale
- [ ] Availability and reliability in designs: redundancy, failover, multi-region, availability math
- [ ] ⭐ Classic designs: URL shortener, news feed, chat, notifications, search autocomplete
- [ ] Security, privacy, and cost in designs
- [ ] Communicating designs: C4 diagrams, design docs, interviews

### 07 · Distributed Systems
[modules/06-design/07-distributed-systems](modules/06-design/07-distributed-systems) · PostgreSQL 18, Redis 8, BullMQ · [cheatsheet](modules/06-design/07-distributed-systems/docs/cheatsheet.md)
- [ ] ⭐ The fallacies of distributed computing; partial failure and unknown outcomes
- [ ] ⭐ CAP and PACELC
- [ ] ⭐ Consistency models: linearizable, sequential, causal, read-your-writes, eventual
- [ ] Replication: single leader, multi-leader, leaderless, quorums, replication lag
- [ ] Partitioning and rebalancing
- [ ] Time and ordering: clock skew, Lamport and vector clocks, hybrid clocks, per-aggregate versions
- [ ] Consensus and coordination: Raft, leader election, distributed locks, fencing tokens
- [ ] ⭐ Delivery guarantees: at-most-once, at-least-once, effectively-once; idempotent consumers
- [ ] ⭐ Distributed transactions: 2PC vs sagas (choreography, orchestration), compensations
- [ ] CQRS and event sourcing in depth: projections, snapshots, upcasting, replays
- [ ] Testing distributed behavior: duplicates, reordering, fault injection, reconciliation

## 07 · Capstone

### 01 · Design & Build
[modules/07-capstone/01-design-build](modules/07-capstone/01-design-build) · Next.js 16, Express 5, TypeScript, PostgreSQL 18, Drizzle ORM, Redis 8, BullMQ · [cheatsheet](modules/07-capstone/01-design-build/docs/cheatsheet.md)
- [ ] ⭐ Product scope and requirements with numbers: features, non-functional targets, out of scope
- [ ] ⭐ Domain discovery: event storming, ubiquitous language, glossary
- [ ] ⭐ Subdomains, bounded contexts, and the context map
- [ ] ⭐ Aggregates and invariants for the core contexts
- [ ] ⭐ Architecture: n-tier, modular monolith, clean architecture inside each bounded context
- [ ] Repository layout, module boundaries, and their enforcement in CI
- [ ] Patterns and SOLID principles applied where they pay off, with a written map
- [ ] System design: estimates, API, data model per context, consistency per operation
- [ ] Asynchronous flows: outbox, checkout saga, idempotent consumers, read models
- [ ] Cross-cutting concerns: auth, authorization, validation, errors, config, observability, resilience
- [ ] Architecture decision records for every major choice
- [ ] Milestones: walking skeleton first, each milestone deployed, tested, and reviewed

### 02 · Pre-Launch Checklist
[modules/07-capstone/02-pre-launch](modules/07-capstone/02-pre-launch) · Next.js 16, Express 5, PostgreSQL 18, Redis 8, AWS, Terraform · [cheatsheet](modules/07-capstone/02-pre-launch/docs/cheatsheet.md)
- [ ] ⭐ Security review: OWASP Top 10:2025, authentication and sessions, authorization tests, headers, secrets, dependency scanning
- [ ] Privacy and legal: data inventory, privacy policy, consent, data subject rights, breach process, terms, accessibility statement
- [ ] ⭐ Reliability: timeouts, safe retries, health checks, graceful shutdown, degradation, load shedding
- [ ] ⭐ Data safety: PITR backups, deletion protection, locked copies, restore drill with measured RTO
- [ ] ⭐ Observability: logs, traces, metrics, error tracking, dashboards, SLOs, alerts with runbooks
- [ ] Operations: on-call, status page, incident process, rehearsed runbooks, cost budgets
- [ ] ⭐ Performance: load test at campaign peak, Core Web Vitals budgets, caching verified
- [ ] Accessibility: WCAG 2.2 AA with automated gates and manual keyboard and screen reader passes
- [ ] SEO and metadata: titles, canonical URLs, sitemap, robots, Open Graph, structured data, noindex outside production
- [ ] ⭐ Infrastructure and delivery: no drift, OIDC, same image staging → production, approval gate, rollback tested
- [ ] Architecture and code health: boundaries enforced, ADRs current, no critical review findings
- [ ] Launch plan: flags, gradual rollout with gates, launch-day checklist, post-launch review
