---
title: Performance cheatsheet
tech: React 19.2, Next.js 16, Vite 8, Lighthouse
version: Core Web Vitals (LCP, INP, CLS), Lighthouse 12, web-vitals 5, Next.js 16, React 19.2
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Performance cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Core Web Vitals
| Metric | Good (p75) | Poor |
|:--|:--|:--|
| ⭐ LCP | ≤ 2.5 s | > 4 s |
| ⭐ INP | ≤ 200 ms | > 500 ms |
| ⭐ CLS | ≤ 0.1 | > 0.25 |
| TTFB | ≤ 0.8 s | > 1.8 s |
| FCP | ≤ 1.8 s | > 3 s |
| TBT (lab proxy for INP) | ≤ 200 ms | > 600 ms |

## Measuring
| Tool | Gives | Note |
|:--|:--|:--|
| ⭐ Lighthouse | lab audit | mobile throttling |
| ⭐ Performance panel | flame chart, LCP element, shifts, live metrics | |
| ⭐ `web-vitals` (attribution) | field metrics + cause | v5 |
| `useReportWebVitals` | Next.js hook | send to `/api/rum` |
| CrUX / PageSpeed Insights | Chrome field data | per URL/origin |
| Search Console CWV report | failing URL groups | |
| WebPageTest | filmstrips, waterfalls | |
| Sentry / App Insights browser SDK | RUM + errors | |
| `navigator.sendBeacon` | send on unload | |

## Budgets and CI
| Item | Example | Note |
|:--|:--|:--|
| ⭐ Lighthouse CI | `lighthouserc.json` assertions | preview deploys |
| `numberOfRuns: 3` | reduce noise | |
| metric budget | LCP ≤ 2500 | |
| size budget | `resource-summary:script:size` | first-load JS |
| deploy markers | vitals per release | |

## LCP phases
| Phase | Fix | Note |
|:--|:--|:--|
| ⭐ TTFB | cache, parallel API calls, fast SQL, same region | includes ASP.NET Core |
| load delay | image in HTML, `priority`, preload | |
| load time | AVIF/WebP, right size, CDN | |
| render delay | small CSS, font swap, server-rendered hero | |

## Images (next/image)
| Prop | Use | Note |
|:--|:--|:--|
| `width`/`height` or `fill` | reserve space | |
| ⭐ `sizes` | pick right file | |
| ⭐ `priority` | LCP image | one per page |
| `quality` | default 75 | |
| `placeholder="blur"` | perceived speed | |
| `remotePatterns` | allowed hosts | Blob/Front Door |
| `formats: ["image/avif","image/webp"]` | modern formats | config |
| `loader` | external image CDN | |

## Fonts
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `next/font/google` / `local` | self-host, subset, fallback metrics | |
| `display: "swap"` | text visible immediately | |
| `subsets: ["latin-ext"]` | Turkish, etc. | |
| `variable: "--font-sans"` | CSS variable | Tailwind |
| ≤ 2 families, variable fonts | fewer files | |
| `size-adjust` fallback | no CLS on swap | automatic |

## Caching and CDN
| Asset | Cache-Control | Note |
|:--|:--|:--|
| ⭐ `/_next/static/*` | `max-age=31536000, immutable` | hashed |
| optimized images | long | per width/quality |
| static/ISR HTML | `s-maxage` + SWR | |
| dynamic HTML | `private, no-store` | |
| public API JSON | short + `ETag` | |
| Front Door | CDN, Brotli, HTTP/3 | |
| same region | origin + API + DB | latency |

## JavaScript cost
| Technique | How | Note |
|:--|:--|:--|
| ⭐ Server Components | no client JS | |
| ⭐ `'use client'` leaves | small islands | |
| ⭐ `next/dynamic` / `import()` | split heavy features | `ssr: false` for browser-only |
| tree shaking | named ESM imports | |
| platform APIs | `Intl`, `<dialog>`, `URL` | |
| dependency review | size before adding | bundlephobia |
| `next build` first-load JS | per route | |
| `@next/bundle-analyzer` | treemap | `ANALYZE=true` |
| Coverage tab | unused bytes | |

## Third-party scripts
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `next/script` `afterInteractive` | default | |
| `lazyOnload` | idle time | non-essential |
| `beforeInteractive` | very early | rare |
| `worker` strategy | Partytown | experimental |
| facades | load on click | video, chat |
| after consent | analytics | |
| none on checkout | risk + speed | |

## INP
| Phase / tool | Fix | Note |
|:--|:--|:--|
| input delay | less JS, defer third parties | |
| processing | smaller handlers | |
| presentation | smaller DOM updates | |
| ⭐ `startTransition` | non-urgent updates | |
| ⭐ `useDeferredValue` | lagging expensive UI | |
| `scheduler.yield()` / `setTimeout` | break long tasks | |
| Web Worker | heavy compute | |
| immediate feedback | < 100 ms | |

## React rendering
| Item | Does | Note |
|:--|:--|:--|
| ⭐ React Compiler | auto-memoization | |
| state colocation | fewer re-renders | |
| split contexts | smaller blast radius | |
| ⭐ `@tanstack/react-virtual` | virtualization | long lists |
| server pagination | fewer rows | API |
| React DevTools Profiler | why it rendered | |
| `content-visibility: auto` | skip off-screen | CSS |

## CLS
| Cause | Fix | Note |
|:--|:--|:--|
| ⭐ unsized media | dimensions / `aspect-ratio` | |
| ⭐ late content above | reserve space / overlays | banners fixed |
| font swap | `next/font` metrics | |
| layout animations | `transform` | |
| ads/embeds | fixed containers | |
| shifts < 500 ms after input | don't count | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| lab-only optimization | users still slow | field p75 |
| sequential server fetches | high TTFB | `Promise.all` |
| no `sizes` | huge images | set `sizes` |
| lazy LCP image | slow LCP | `priority` |
| `'use client'` high in tree | big bundles | leaves |
| whole-library imports | bloat | named/platform |
| banner pushing content | CLS | overlay |
| rendering 5,000 rows | jank | virtualize/paginate |
| analytics before consent | legal + speed | after consent |

## Sources
| Source | Link |
|:--|:--|
| Web Vitals | https://web.dev/articles/vitals |
| Optimize LCP | https://web.dev/articles/optimize-lcp |
| Optimize INP | https://web.dev/articles/optimize-inp |
| Optimize CLS | https://web.dev/articles/optimize-cls |
| web-vitals | https://github.com/GoogleChrome/web-vitals |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci |
| next/image | https://nextjs.org/docs/app/api-reference/components/image |
| next/font | https://nextjs.org/docs/app/api-reference/components/font |
| next/script | https://nextjs.org/docs/app/api-reference/components/script |
