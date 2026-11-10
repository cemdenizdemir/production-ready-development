---
title: Framework (React) cheatsheet
tech: React 19.2, TypeScript, Vite 8
version: React 19.2, React Compiler 1.0, Vite 8, @vitejs/plugin-react 6, TypeScript 6.0
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
---
# Framework (React) cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Model
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ UI = f(props, state) | components are functions | |
| render → commit → effects | the cycle | |
| ⭐ pure render | no side effects while rendering | Strict Mode double-renders in dev |
| re-render triggers | state change, parent render, context change | |
| `<StrictMode>` | dev checks | double effects too |

## JSX
| Item | Example | Note |
|:--|:--|:--|
| expressions | `{value}` | |
| attributes | `className`, `htmlFor`, `onClick` | camelCase |
| fragments | `<>…</>` | |
| conditional | `cond ? <A/> : <B/>` / `cond && <A/>` | `0 &&` renders 0 |
| lists | `items.map(i => <li key={i.id}/>)` | |
| `children` | nested content | `ReactNode` |
| spread props | `{...rest}` | |
| `<title>`, `<meta>` in components | document metadata | React 19 |

## State and props
| Item | Rule | Note |
|:--|:--|:--|
| ⭐ props are read-only | parent owns them | |
| ⭐ minimal state | derive the rest | |
| ⭐ lift state up | closest common parent | |
| updater form | `setX(prev => …)` | dependent updates |
| immutable updates | spread, `map`, `filter` | |
| `key` reset | `<Form key={id}/>` | resets state |
| ⭐ stable keys | domain IDs | not indexes |

## Hooks
| Hook | Use | Note |
|:--|:--|:--|
| ⭐ `useState` | local state | |
| `useReducer` | state transitions | testable reducer |
| ⭐ `useEffect` | sync with external systems | cleanup |
| `useLayoutEffect` | measure before paint | rare |
| `useRef` | mutable box, DOM ref | no re-render |
| `useContext` | read context | |
| `useId` | stable IDs | labels, ARIA |
| `useSyncExternalStore` | external subscriptions | |
| `useMemo` / `useCallback` | memoization | compiler mostly handles |
| ⭐ `useEffectEvent` | latest values inside effects | React 19.2 |
| `useTransition` | non-urgent updates | |
| `useDeferredValue` | lagging value | |
| `useActionState` | action state + pending | React 19 |
| `useOptimistic` | optimistic UI | React 19 |
| `use(promise / context)` | read resources | React 19 |
| `useFormStatus` | parent form status | `react-dom` |
| `useImperativeHandle` | custom ref API | rare |

## Effects
| Need | Effect? | Instead |
|:--|:--|:--|
| derived value | no | compute in render |
| user action | no | event handler |
| server data | no | TanStack Query / RSC |
| reset on prop change | no | `key` |
| ⭐ subscription, timer, widget | yes | with cleanup |
| analytics on view | yes | |
| cleanup | runs before re-run and on unmount | |

## Composition
| Pattern | Use | Note |
|:--|:--|:--|
| ⭐ `children` | flexible content | |
| slots (`ReactNode` props) | named areas | header/footer |
| compound components | shared implicit state | Tabs, Menu |
| ⭐ custom hooks | reuse logic | `useX` |
| context | global-ish values | theme, user, locale |
| render props | caller renders items | lists |
| `ref` as prop | no `forwardRef` | React 19 |

## Actions and forms
| API | Does | Note |
|:--|:--|:--|
| ⭐ `<form action={fn}>` | submit with FormData | resets on success |
| ⭐ `useActionState(fn, init)` | `[state, action, isPending]` | |
| `useFormStatus()` | `{ pending }` | inside the form |
| `useOptimistic` | temporary optimistic state | reverts on error |
| `startTransition(async () => …)` | async action | |
| `requestFormReset(form)` | reset manually | |

## Suspense and transitions
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `<Suspense fallback>` | loading boundary | per section |
| `lazy(() => import())` | code-split component | |
| `useSuspenseQuery` | suspense data | TanStack Query |
| ⭐ `useTransition` | keep UI responsive | |
| `useDeferredValue` | render older value first | |
| `<Activity mode>` | hide but keep state | React 19.2 |

## Errors
| Item | Does | Note |
|:--|:--|:--|
| ⭐ error boundary | catch render errors | not handlers/async |
| `react-error-boundary` | boundary with reset | |
| `createRoot(el, { onUncaughtError, onCaughtError, onRecoverableError })` | root error callbacks | React 19 |
| `Sentry.reactErrorHandler()` | report | |
| Next.js `error.tsx` | route boundary | 06-rendering |

## Memoization and the compiler
| Item | Does | Note |
|:--|:--|:--|
| ⭐ React Compiler | auto memoization | 1.0 stable |
| `reactCompiler: true` | enable in Next.js 16 | |
| `memo(C)` | skip render if props equal | manual |
| `"use no memo"` | opt a component out | escape hatch |
| `eslint-plugin-react-hooks` | rules + compiler diagnostics | |
| React DevTools Profiler | why it rendered | |
| virtualization | long lists | 07-performance |

## Vite 8
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `pnpm create vite@latest -- --template react-ts` | new app | |
| `vite` / `vite build` / `vite preview` | dev / build / serve build | |
| Rolldown | bundler | Vite 8 |
| `@vitejs/plugin-react` | Fast Refresh | |
| ⭐ `server.proxy['/api']` | forward to ASP.NET Core | `secure: false` for dev cert |
| `import.meta.env.VITE_*` | public env | inlined |
| `.env.[mode]` | env files | |
| `resolve.alias` | `@/` imports | match `tsconfig` paths |
| `tsc -b --noEmit` | type check | Vite doesn't |
| `@tailwindcss/vite` | Tailwind plugin | |

## Project structure
| Folder | Holds | Note |
|:--|:--|:--|
| ⭐ `features/<name>/` | components, hooks, queries, tests | colocated |
| `components/ui/` | design-system primitives | |
| `api/` | Orval-generated client + fetcher | don't edit generated |
| `lib/` | utilities | money, dates |
| `features/x/index.ts` | public surface | |
| `no-restricted-imports` | enforce boundaries | ESLint |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| derived state in `useEffect` | extra renders, drift | compute in render |
| index keys | state on wrong row | IDs |
| fetch in effect without abort | races | TanStack Query |
| missing effect cleanup | leaks, double subscriptions | return cleanup |
| hooks in conditions | broken order | top level |
| memo everywhere | noise, stale bugs | compiler |
| `0 && <X/>` | renders "0" | `count > 0 &&` |
| secrets in `VITE_*` | public bundle | server only |
| error boundary for handler errors | not caught | try/catch + state |

## Sources
| Source | Link |
|:--|:--|
| react.dev Learn | https://react.dev/learn |
| Hooks reference | https://react.dev/reference/react/hooks |
| You might not need an effect | https://react.dev/learn/you-might-not-need-an-effect |
| React 19 | https://react.dev/blog/2024/12/05/react-19 |
| React 19.2 | https://react.dev/blog/2025/10/01/react-19-2 |
| React Compiler | https://react.dev/learn/react-compiler |
| Vite | https://vite.dev/guide/ |
| react-error-boundary | https://github.com/bvaughn/react-error-boundary |
