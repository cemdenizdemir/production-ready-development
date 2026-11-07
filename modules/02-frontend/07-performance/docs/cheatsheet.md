---
title: Performance cheatsheet
tech: React 19.2, Next.js 16, Vite 8, Lighthouse
version: Core Web Vitals (LCP, INP, CLS), Lighthouse, web-vitals 5, Next.js 16, React 19.2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Performance cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Metrics and thresholds (p75)
| Metric | Good | Poor | Measures |
|:--|:--|:--|:--|
| ⭐ LCP | ≤ 2.5 s | > 4 s | main content visible |
| ⭐ INP | ≤ 200 ms | > 500 ms | interaction responsiveness |
| ⭐ CLS | ≤ 0.1 | > 0.25 | visual stability |
| TTFB | ≤ 0.8 s | > 1.8 s | server + network |
| FCP | ≤ 1.8 s | > 3 s | first content |
| TBT (lab) | ≤ 200 ms | > 600 ms | blocking time, INP proxy |
| FID | removed | | replaced by INP (2024) |
| Long task | > 50 ms | | blocks input |
| Frame budget | ~16.7 ms | | 60 fps |

## Measuring tools
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ DevTools Performance panel | traces, live metrics, insights | throttle CPU 4× |
| ⭐ Lighthouse | lab audit | DevTools, CLI, PSI |
| ⭐ PageSpeed Insights | field (CrUX) + lab | public URLs |
| CrUX / CrUX Vis | 28-day Chrome field data | origin and URL level |
| Search Console CWV report | field data grouped by URL | |
| ⭐ `web-vitals` | RUM in your app | `web-vitals/attribution` |
| `useReportWebVitals` | Next.js RUM hook | `next/web-vitals` |
| WebPageTest | deep lab tests, filmstrips | also seen |
| ⭐ Lighthouse CI | budgets in CI | `lhci autorun` |
| React DevTools Profiler | component render costs | |
| React performance tracks | React lanes in Performance panel | React 19.2 |
| Coverage tab | unused JS/CSS | |
| Long Animation Frames API | field attribution of slow frames | Chrome |
| Sentry performance | traces + web vitals per release | 13-testing-monitoring |

## LCP breakdown
| Sub-part | Fix |
|:--|:--|
| ⭐ TTFB | CDN, cached shell, fewer redirects, fast backend |
| ⭐ Load delay | hero in HTML, `fetchpriority="high"`, preload |
| Load duration | AVIF/WebP, right size, CDN, compression |
| Render delay | less render-blocking CSS/JS, server-render hero |

## Loading hints
| Hint | What it does | Note |
|:--|:--|:--|
| ⭐ `fetchpriority="high"` | prioritize a resource | LCP image |
| ⭐ `loading="lazy"` | defer offscreen images | not the LCP image |
| `rel="preconnect"` | warm a connection | 1–3 critical origins |
| `rel="preload"` | fetch early | fonts, CSS backgrounds |
| `rel="modulepreload"` | preload JS modules | |
| `rel="prefetch"` | next-page resources | |
| 103 Early Hints | preload before HTML | CDN |
| Speculation Rules | prerender next pages | Chromium |
| `defer` / `type="module"` | non-blocking scripts | |
| bfcache | instant back/forward | avoid `unload` |

## Images
| Practice | What it does | Note |
|:--|:--|:--|
| ⭐ AVIF / WebP | smaller files | fallback JPEG |
| ⭐ `srcset` + `sizes` | right resolution | |
| ⭐ `width`/`height` / `aspect-ratio` | no CLS | |
| ⭐ `next/image` | sizes, formats, lazy, space | |
| `fetchPriority="high"` on `next/image` | LCP image | `priority` deprecated in 16 (use `preload`) |
| `sizes` prop | needed for fill/responsive images | avoids oversized downloads |
| `placeholder="blur"` | blurred preview | static imports |
| `images.qualities` | allowed quality values | Next 16 default `[75]` |
| `images.remotePatterns` | allowed remote sources | |
| Upload limits + resizing | no 6000 px originals | pipeline |

## Fonts
| Practice | What it does | Note |
|:--|:--|:--|
| ⭐ `next/font` | self-host, preload, metric fallback | Google + local |
| ⭐ `font-display: swap` / `optional` | text visible immediately | |
| Variable fonts | one file, many weights | |
| `subsets: ['latin']` / `unicode-range` | smaller files | |
| `size-adjust`, `ascent-override` | match fallback metrics | CLS |
| System font stack | no font download | |
| Preconnect to font origin | if not self-hosted | |

## JavaScript cost
| Lever | What it does | Note |
|:--|:--|:--|
| ⭐ Server Components | no JS for static UI | |
| ⭐ Route splitting | per-route chunks | automatic in Next |
| ⭐ `next/dynamic` / `lazy()` / `import()` | load on demand | editors, charts |
| ⭐ Tree shaking | drop unused exports | ESM, `sideEffects: false` |
| `optimizePackageImports` | avoid barrel bloat | Next config |
| Bundle analyzer | find heavy modules | Next / Vite plugins |
| Modern build targets | no legacy transpiling | Baseline |
| Dependency review | size before adding | bundlephobia |
| JS budget | per-route KB limit | CI |
| `size-limit` | fail CI on size growth | also seen |

## Third-party scripts
| Practice | What it does | Note |
|:--|:--|:--|
| ⭐ Audit | owner + reason per script | |
| ⭐ `strategy="lazyOnload"` | load in idle time | `next/script` |
| `afterInteractive` | default | |
| `beforeInteractive` | before hydration | rare |
| `worker` | Partytown worker | experimental |
| ⭐ Facades | placeholder until click | video, chat, maps |
| `@next/third-parties` | optimized GTM, YouTube, Maps | |
| Consent gating | load after consent | GDPR |
| Self-host/proxy | fewer origins | |

## INP
| Phase / technique | What it does | Note |
|:--|:--|:--|
| ⭐ Input delay | busy main thread before handler | defer scripts, smaller hydration |
| ⭐ Processing | handler + render time | do less, feedback first |
| ⭐ Presentation delay | layout/paint after | smaller DOM |
| ⭐ `startTransition` / `useTransition` | non-urgent updates | React |
| `useDeferredValue` | lagging expensive render | React |
| ⭐ `scheduler.yield()` | yield, keep priority | Chromium, Firefox |
| `setTimeout(0)` chunking | yield fallback | |
| Web Workers | off-main-thread work | |
| Debounce input | fewer renders | search |
| Avoid layout thrashing | batch reads/writes | |
| `requestIdleCallback` | idle-time work | analytics |

## CLS
| Cause | Fix |
|:--|:--|
| ⭐ Unsized media | width/height, aspect-ratio |
| ⭐ Late embeds/ads | reserved space |
| ⭐ Injected banners | overlays, or reserve space |
| Font swaps | `next/font`, metric overrides |
| Layout animations | transform/opacity |
| Mismatched skeletons | same size as content |
| Interaction exemption | shifts < 500 ms after input don't count |

## React rendering
| Technique | What it does | Note |
|:--|:--|:--|
| ⭐ Profile first | React DevTools Profiler | "why did this render" |
| ⭐ Colocate state | smaller re-render scope | |
| ⭐ React Compiler | auto-memoization | 1.0 |
| Split contexts | fewer consumers re-render | |
| ⭐ Virtualization | render visible rows only | TanStack Virtual (also seen) |
| `content-visibility: auto` | skip offscreen rendering | CSS |
| Pagination | smaller DOM | |
| Avoid inline heavy computation | memoize or server-side | |
| Smaller client islands | less hydration | |

## Caching for frontends
| Asset | Cache-Control |
|:--|:--|
| ⭐ Hashed JS/CSS/fonts/images | `public, max-age=31536000, immutable` |
| ⭐ HTML | `no-cache` or short `s-maxage` + `stale-while-revalidate` |
| Optimized images | long CDN cache |
| API data | per endpoint |
| Service worker | offline/runtime caching (also seen: Workbox) |

## Budgets and CI
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `lighthouserc.json` assertions | fail on regressions | minScore, maxNumericValue |
| `numberOfRuns: 3` | reduce noise | median |
| Production build in CI | realistic numbers | `next build && next start` |
| `treosh/lighthouse-ci-action` | GitHub Action | also seen |
| JS size budget | KB per route | |
| RUM alerts | p75 regressions per release | Sentry/Grafana |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Lazy LCP image | slow LCP | high fetch priority |
| CSS background hero | discovered late | `<img>` / preload |
| Fast-laptop testing | misleading | throttle + field data |
| Averages | hide slow tail | p75 |
| Heavy import in layout | every page pays | dynamic import |
| Third-party tags early | input delay | lazyOnload, facades |
| Unsized embeds | CLS | reserve space |
| Banner above content | CLS | overlay |
| 5,000-row render | jank | virtualization |
| `memo` everywhere | noise | profile; compiler |
| `no-store` on hashed assets | re-downloads | immutable |
| `unload` handlers | no bfcache | `pagehide` |

## Sources
| Source | Link |
|:--|:--|
| web.dev Web Vitals | https://web.dev/articles/vitals |
| web.dev Learn Performance | https://web.dev/learn/performance |
| Optimize LCP | https://web.dev/articles/optimize-lcp |
| Optimize INP | https://web.dev/articles/optimize-inp |
| Optimize CLS | https://web.dev/articles/optimize-cls |
| Chrome DevTools Performance | https://developer.chrome.com/docs/devtools/performance |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci |
| Next.js Image | https://nextjs.org/docs/app/api-reference/components/image |
