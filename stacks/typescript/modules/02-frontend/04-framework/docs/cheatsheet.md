---
title: Framework (React) cheatsheet
tech: React 19.2, TypeScript, Vite 8
version: React 19.2, React Compiler 1.0, Vite 8, @vitejs/plugin-react 6, TypeScript 6.0
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Framework (React) cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Core model
| Concept | What it means | Note |
|:--|:--|:--|
| ⭐ Component | function returning JSX | PascalCase |
| ⭐ Render | React calls your component | must be pure |
| Commit | React updates the DOM | minimal changes |
| ⭐ Re-render triggers | own state, parent render, context change | not prop "changes" alone |
| ⭐ Props | read-only inputs | never mutate |
| ⭐ State | component memory | snapshot per render |
| ⭐ Derived state | compute during render | don't store it |
| Lifting state up | shared state in closest common parent | data down, events up |
| Controlled input | value from state + `onChange` | |
| Uncontrolled input | DOM keeps value; read via FormData/ref | forms with Actions |
| `<StrictMode>` | double render/effects in dev | finds impurity, missing cleanup |
| Fragment | `<>...</>` | group without a DOM node |

## JSX essentials
| Item | Example | Note |
|:--|:--|:--|
| Expressions | `{user.name}` | |
| Attributes | `className`, `htmlFor`, `onClick` | camelCase |
| Conditional | `{ok ? <A /> : <B />}` | |
| ⭐ `&&` with numbers | `{n > 0 && <Badge />}` | `{n && …}` renders 0 |
| ⭐ Lists | `{items.map((i) => <Row key={i.id} />)}` | stable keys |
| `key` to reset | `<Form key={userId} />` | fresh state |
| Style | `style={{ width: 100 }}` | prefer classes |
| Spread props | `<Input {...props} />` | |
| `dangerouslySetInnerHTML` | raw HTML | sanitize (11-security) |

## Hooks
| Hook | Use | Note |
|:--|:--|:--|
| ⭐ `useState` | local state | updater fn for prev-based updates |
| ⭐ `useReducer` | named state transitions | state machines |
| ⭐ `useEffect` | sync with external systems | cleanup function |
| `useLayoutEffect` | measure before paint | rare |
| ⭐ `useRef` | mutable box / DOM ref | doesn't re-render |
| ⭐ `useContext` / `use(Context)` | read context | `use` can be conditional |
| ⭐ `useId` | stable IDs for a11y attrs | SSR-safe |
| `useMemo` / `useCallback` | memoize value / function | mostly automatic with compiler |
| `useSyncExternalStore` | subscribe to external stores | browser APIs |
| `useImperativeHandle` | custom ref API | rare |
| `useDebugValue` | label custom hooks in DevTools | |
| `useInsertionEffect` | CSS-in-JS libraries | library authors |
| ⭐ `useTransition` | non-urgent updates + pending | |
| ⭐ `useDeferredValue` | lagging value for expensive renders | optional initial value |
| ⭐ `useActionState` | Action state + pending | React 19 |
| ⭐ `useFormStatus` | parent form pending | from `react-dom` |
| ⭐ `useOptimistic` | optimistic value during Actions | React 19 |
| ⭐ `use(promise)` | read a promise with Suspense | stable promises only |
| ⭐ `useEffectEvent` | latest values inside effects, not deps | React 19.2 |
| Rules of hooks | top level, components/hooks only | lint enforces |

## Effects
| Situation | Do | Note |
|:--|:--|:--|
| ⭐ Value from props/state | compute in render | no effect |
| ⭐ User event | event handler | no effect |
| Reset on prop change | `key` | no effect |
| ⭐ Server data | TanStack Query / Server Components | not raw effects |
| Subscription / socket / timer | `useEffect` + cleanup | |
| External store | `useSyncExternalStore` | |
| Race conditions | AbortController or ignore flag in cleanup | |
| ⭐ Dependencies | list everything reactive used | never disable the lint rule |
| Non-reactive logic | `useEffectEvent` | 19.2 |

## React 19 / 19.2 APIs
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `<form action={fn}>` | Action-based forms | resets uncontrolled fields |
| `startTransition(async fn)` | async transitions = Actions | |
| ⭐ `ref` as a prop | no `forwardRef` | React 19 |
| `<Context value>` | provider without `.Provider` | React 19 |
| Ref cleanup | ref callback returns cleanup | React 19 |
| `<title>`, `<meta>`, `<link>` in components | hoisted to `<head>` | React 19 |
| `preload` / `preinit` / `preconnect` | resource hints from `react-dom` | |
| ⭐ `<Activity mode="hidden">` | hide UI, keep state | 19.2 |
| `cacheSignal()` | abort work when a cache lifetime ends | RSC, 19.2 |
| Performance tracks | React lanes in Chrome DevTools | 19.2 |
| `prerender` / `resume` | partial pre-rendering APIs | 19.2, frameworks |

## Suspense and code splitting
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `<Suspense fallback>` | show fallback while children suspend | nest for progressive UI |
| ⭐ `lazy(() => import('./X.tsx'))` | code-split a component | default export needed |
| `useSuspenseQuery` | TanStack Query + Suspense | 05-state-management |
| Transitions + Suspense | keep old UI instead of fallback | |
| Error boundary + Suspense | handle load failures | |

## Composition
| Pattern | Use | Example |
|:--|:--|:--|
| ⭐ `children` | caller fills content | `<Card>{…}</Card>` |
| Slot props | named regions | `sidebar={<Nav />}` |
| ⭐ Compound components | parts sharing context | `<Tabs.Tab>` |
| ⭐ Custom hooks | reuse stateful logic | `useOnlineStatus()` |
| Render props | caller renders with data | less common now |
| HOCs | wrap components | legacy; prefer hooks |
| Context | global-ish values | split by concern |
| Polymorphic `as` prop | render as another element | typed carefully |

## Error handling
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Error boundary | catches render errors below it | class component |
| `getDerivedStateFromError` | switch to fallback | |
| `componentDidCatch` | report error + component stack | |
| Not caught | event handlers, async code, SSR, the boundary itself | try/catch + state |
| `onUncaughtError` / `onCaughtError` / `onRecoverableError` | root-level reporting | `createRoot` options |
| `react-error-boundary` | hooks-friendly boundaries | also seen |

## React Compiler
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ Auto-memoization | memoizes components and hooks at build time | 1.0 stable |
| ⭐ Rules of React | purity, immutability, hooks rules | required |
| `"use no memo"` | opt a function/file out | debugging |
| `babel-plugin-react-compiler` | the compiler | |
| Vite 8 wiring | `@rolldown/plugin-babel` + `reactCompilerPreset` | plugin-react v6 |
| Next.js 16 | `reactCompiler: true` in next.config | stable |
| ⭐ `eslint-plugin-react-hooks` 7 | `configs.flat.recommended` | compiler rules included |
| React DevTools Profiler | why/when components rendered | measure first |
| "Memo" badge in React DevTools | marks compiled components | check the compiler ran |

## Vite 8
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `pnpm create vite@latest app -- --template react-ts` | scaffold | |
| ⭐ `vite` / `vite build` / `vite preview` | dev / build / serve build | |
| Rolldown | Rust bundler | Vite 8 default |
| Oxc | fast transforms | |
| ⭐ `server.proxy` | forward `/api` to the backend | same origin in dev |
| ⭐ `resolve.alias` | `@/` imports | sync tsconfig `paths` |
| ⭐ `import.meta.env.VITE_*` | public env values | inlined at build |
| `.env.[mode]` + `--mode` | per-mode env files | |
| `loadEnv()` | env in `vite.config.ts` | |
| `build.sourcemap: 'hidden'` | maps for Sentry | not served |
| `build.target` | output syntax level | defaults to Baseline widely available |
| `optimizeDeps` | pre-bundle dependencies in dev | |
| `import.meta.glob` | import many files by pattern | |
| `?raw` / `?url` / `?worker` imports | asset import suffixes | |
| HMR / Fast Refresh | keep state while editing | |
| ⭐ `tsc -b` | type check (Vite doesn't) | build script, CI |
| `vite-env.d.ts` | `vite/client` types, `ImportMetaEnv` | |

## Project structure
| Folder | Contains |
|:--|:--|
| `src/app/` | shell, routes, providers |
| ⭐ `src/features/<name>/` | components, hooks, api, types, tests |
| `src/components/ui/` | shared presentational components |
| `src/lib/` | framework-free helpers |
| Colocation | tests and styles next to components |
| Path alias `@/` | no `../../../` |
| Avoid mega-barrels | slow tooling, circular imports |

## TypeScript with React
| Item | Example |
|:--|:--|
| Props type | `function Row({ item }: { item: Item })` |
| Children | `children: ReactNode` |
| Native props | `ComponentProps<'button'>` |
| Event types | `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent` |
| Ref types | `useRef<HTMLInputElement>(null)` |
| Generic component | `function List<T>({ items, render }: { items: T[]; render: (t: T) => ReactNode })` |
| State with unions | `useState<'idle' \| 'saving' \| 'error'>('idle')` |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Index as key | state on wrong rows | stable IDs |
| `{count && …}` | renders `0` | `count > 0 &&` |
| Storing derived data | out of sync | compute in render |
| Mutating state | no re-render | new objects/arrays |
| Effects for events | double requests, loops | handlers |
| Missing cleanup | leaks, duplicate subscriptions | return cleanup |
| Disabled exhaustive-deps | stale closures | `useEffectEvent`, restructure |
| `use(fetch())` in render | infinite suspend | stable promises |
| Boundaries for handler errors | not caught | try/catch |
| Manual memo everywhere | noise, stale deps | React Compiler |
| Secrets in `VITE_*` | public bundle | server-side only |
| Vite = type checker | type errors at runtime | `tsc -b` |

## Sources
| Source | Link |
|:--|:--|
| react.dev Learn | https://react.dev/learn |
| react.dev Reference | https://react.dev/reference/react |
| React 19.2 release | https://react.dev/blog/2025/10/01/react-19-2 |
| React Compiler | https://react.dev/learn/react-compiler |
| Rules of React | https://react.dev/reference/rules |
| Vite guide | https://vite.dev/guide/ |
| Vite config | https://vite.dev/config/ |
| plugin-react | https://github.com/vitejs/vite-plugin-react |
