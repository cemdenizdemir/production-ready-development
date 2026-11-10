---
title: Documentation cheatsheet
tech: Markdown, OpenAPI 3.1 (from Zod), Scalar
version: GitHub Flavored Markdown, OpenAPI 3.1, zod-openapi 5 (Zod 4), Scalar API Reference
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Documentation cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Kinds of docs (Diátaxis)
| Kind | For | Shape |
|:--|:--|:--|
| ⭐ Tutorial | learning by doing | guided, always succeeds |
| ⭐ How-to guide | doing a task | goal-focused steps |
| ⭐ Reference | looking things up | complete, dry, generated when possible |
| ⭐ Explanation | understanding why | context, trade-offs, ADRs |
| README | first contact | what, quick start, links |
| Runbook | operating under stress | alerts → actions |
| ADR | recording a decision | context, decision, consequences |
| CHANGELOG | what changed per version | human-curated |
| CONTRIBUTING | how to contribute | branch, commit, PR rules |
| SECURITY.md | how to report vulnerabilities | private channel, SLA |
| CODE_OF_CONDUCT.md | community rules | open source |
| Design doc / RFC | proposal before building | reviewed before code |

## README sections
| Section | Contents |
|:--|:--|
| ⭐ What and why | 1–2 sentences |
| ⭐ Quick start | prerequisites with versions + copy-paste commands |
| Configuration | link `.env.example` |
| Common tasks | test, lint, migrate, seed |
| Architecture | one diagram + links |
| Deploy / operate | link runbooks |
| Troubleshooting | real error messages + fixes |
| Contributing / license | links |

## Markdown (GitHub Flavored)
| Feature | Syntax | Note |
|:--|:--|:--|
| ⭐ Headings | `#` … `######` | keep levels in order |
| ⭐ Relative link | `[Text](docs/a.md#section)` | works on any branch |
| Heading anchor | `#lowercase-with-dashes` | auto-generated |
| ⭐ Code fence | three backticks + language | `ts`, `bash`, `json`, `diff` |
| Inline code | `` `code` `` | double backticks if it contains one |
| Table | `\| a \| b \|` + `\|:--\|` | escape pipes as `\|` |
| Task list | `- [ ] todo` / `- [x] done` | |
| ⭐ Alerts | `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` | GitHub only |
| Collapsible | `<details><summary>Title</summary>` … `</details>` | blank line after summary |
| ⭐ Mermaid | code fence with `mermaid` | flowchart, sequence, gitGraph, erDiagram |
| Footnote | `text[^1]` … `[^1]: note` | |
| Math | `$x^2$`, `$$...$$` | GitHub renders LaTeX |
| Image | `![alt text](img.png)` | always write alt text |
| Line break | blank line = paragraph | trailing `\` = line break |
| Emoji shortcodes | `:warning:` | avoid in this course |
| Comments | `<!-- hidden -->` | not rendered |

## Mermaid diagram types
| Type | First line | Use |
|:--|:--|:--|
| Flowchart | `flowchart LR` | architecture, data flow |
| Sequence | `sequenceDiagram` | request flows, protocols |
| ER diagram | `erDiagram` | database schemas |
| State | `stateDiagram-v2` | order/job lifecycles |
| Git graph | `gitGraph` | branching strategies |
| Gantt | `gantt` | timelines |
| Class | `classDiagram` | domain models |
| C4 | `C4Context` | system context diagrams (experimental) |

## ADRs
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ File | `docs/adr/0007-short-title.md` | numbered, kebab-case |
| ⭐ Status | proposed, accepted, deprecated, superseded | |
| ⭐ Context | forces, constraints, options | |
| ⭐ Decision | what we do, active voice | |
| ⭐ Consequences | gains, costs, follow-ups | |
| Immutable | supersede, don't edit | history of why |
| MADR | richer ADR template (options, pros/cons) | also seen |
| When | costly-to-reverse decisions | DB, framework, auth, hosting |

## Runbooks
| Section | Contents |
|:--|:--|
| ⭐ Overview | purpose, owner, dependencies |
| ⭐ Links | dashboards, logs, traces, deploy pipeline |
| ⭐ Alert → action | meaning, confirm, mitigate, verify |
| Common operations | deploy, rollback, scale, drain queue, rotate secret |
| Escalation | who and when |
| Last reviewed | date + owner |

## Changelog and releases
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ Keep a Changelog | `## [x.y.z] - date` + typed sections | Added, Changed, Deprecated, Removed, Fixed, Security |
| `## [Unreleased]` | collects upcoming changes | |
| ⭐ Breaking changes first | with migration notes | |
| GitHub generated notes | from PR titles + labels | `.github/release.yml` |
| SemVer | MAJOR.MINOR.PATCH | see 01-git |
| release-please / Changesets | automate versions + changelogs | also seen |

## OpenAPI 3.1 structure
| Field | What it holds | Note |
|:--|:--|:--|
| ⭐ `openapi` | spec version | `3.1.0` |
| ⭐ `info` | title, version, description | API version, not spec |
| `servers` | base URLs | per environment |
| ⭐ `paths` | path → method → operation | |
| `operationId` | unique operation name | SDK method names |
| `parameters` | path, query, header, cookie | `in: query` |
| ⭐ `requestBody` | content type → schema | `application/json` |
| ⭐ `responses` | status → description + content | include errors |
| ⭐ `components.schemas` | reusable schemas | `$ref` |
| `components.securitySchemes` | `http` bearer, `apiKey` cookie, `oauth2` | |
| `security` | required schemes | global or per operation |
| `tags` | grouping in UIs | |
| `deprecated: true` | mark operations/params | add replacement in description |
| `examples` / `example` | sample values | realistic |
| `webhooks` | outgoing webhook payloads | 3.1 feature |
| JSON Schema 2020-12 | schema dialect in 3.1 | `type: ['string', 'null']` instead of `nullable` |
| OpenAPI 3.2 | Sept 2025: `QUERY`, streaming media types | tooling catching up |

## Zod → OpenAPI (zod-openapi 5, Zod 4)
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `createDocument({...})` | builds the OpenAPI object | from `zod-openapi` |
| ⭐ `.meta({ id: 'Order' })` | named component + `$ref` | Zod 4 native metadata |
| `.meta({ description, example })` | field docs | |
| `requestParams: { path, query, header }` | params from Zod objects | |
| `requestBody.content[type].schema` | body schema | |
| `responses[code].content[type].schema` | response schema | |
| `z.toJSONSchema(schema)` | plain JSON Schema from Zod 4 | built in |
| `z.iso.datetime()` / `z.uuid()` / `z.email()` | formats appear in the spec | |
| also seen | `@asteasolutions/zod-to-openapi` | registry-based |

## Scalar
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ `@scalar/express-api-reference` | Express middleware | |
| ⭐ `app.use('/docs', apiReference({ url: '/openapi.json' }))` | serve the UI | |
| `theme`, `layout` options | look and layout | |
| CDN assets | UI loads from a CDN by default | adjust CSP for `/docs` |
| Try-it client | send requests from the docs | careful with prod auth |
| also seen | Swagger UI, Redoc, Stoplight Elements | |

## Documenting an endpoint
| Topic | Must say |
|:--|:--|
| ⭐ All responses | success + 400/401/403/404/409/422/429 as relevant |
| ⭐ Error schema | one Problem Details schema |
| ⭐ Auth | scheme + which operations |
| Pagination | params, limits, response metadata |
| Idempotency | `Idempotency-Key` support |
| Rate limits | limits + headers |
| Deprecation | flag + replacement + date |
| Examples | request and response |
| Units | cents, ms, ISO 8601 dates, time zones |

## TSDoc
| Tag | Use |
|:--|:--|
| ⭐ summary line | one sentence |
| ⭐ `@param name -` | meaning, units, limits |
| ⭐ `@returns` | output |
| `@throws` | errors and when |
| `@example` | short usage |
| ⭐ `@deprecated` | replacement + removal version |
| `@see`, `{@link X}` | references |
| `@remarks` | longer notes |
| `@internal` | not public API |
| TypeDoc (also seen) | generates an HTML reference from TSDoc |

## Docs-as-code checks
| Check | Tool / command | Note |
|:--|:--|:--|
| ⭐ Generated spec up to date | regenerate + `git diff --exit-code` | CI |
| ⭐ Internal links | `lychee --offline` | every PR |
| External links | `lychee` on a schedule | flaky on PRs |
| OpenAPI lint | Redocly CLI, Spectral | also seen |
| Markdown lint | markdownlint | also seen |
| Prose lint | Vale | also seen |
| Spelling | cspell | also seen |
| Docs in PR template | "docs updated?" checkbox | |
| CODEOWNERS on `docs/` | owners review | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Hand-written API docs | drift from code | generate from Zod |
| Happy path only | integrators crash on errors | document every status |
| Absolute branch links | break after merge | relative links |
| Screenshots of text | can't copy or search | code blocks |
| Edited accepted ADR | lost history | supersede |
| Comment restates code | rots, adds noise | comment why |
| Units missing | 1000× bugs | name + doc units |
| External link checks on PRs | random failures | schedule them |
| Docs in a separate wiki | never updated | repo + same PR |
| Scalar blocked by CSP | blank docs page | route-specific CSP |

## Sources
| Source | Link |
|:--|:--|
| Diátaxis | https://diataxis.fr/ |
| GitHub Markdown docs | https://docs.github.com/en/get-started/writing-on-github |
| Mermaid | https://mermaid.js.org/ |
| ADR templates | https://adr.github.io/ |
| Keep a Changelog | https://keepachangelog.com/en/1.1.0/ |
| OpenAPI 3.1 spec | https://spec.openapis.org/oas/v3.1.0 |
| zod-openapi | https://github.com/samchungy/zod-openapi |
| Scalar | https://github.com/scalar/scalar |
| TSDoc | https://tsdoc.org/ |
