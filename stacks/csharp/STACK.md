# Stack
Decided stack for this repo. The learn and review prompts read this file.
Updated: 2026-11-09

## Goal
- Target: .NET back-end developer jobs on Azure, following the tools of the Microsoft Back-End Developer Professional Certificate (Coursera); no single market
- Level: mid-level (has shipped production code in TypeScript); new to C# and .NET
- Time per week: ~10 h; the certificate is ~306 h (6–7 months)
- Constraints: flexible cloud budget; Windows 11 with WSL2; C# and ASP.NET Core backend fixed; frontend matches the TypeScript stack

## Choices
| Layer | Choice | Why | Status |
|:--|:--|:--|:--|
| Language | C# 14, .NET 10 LTS | course language; LTS until Nov 2028 | decided |
| Editor and debugger | VS Code + C# Dev Kit; Visual Studio 2026 Community | course tools; Visual Studio for profiling | decided |
| Package manager and monorepo | NuGet + Central Package Management, `.slnx`; pnpm for the frontend | one versions file; frontend unchanged | decided |
| Lint and format | .NET analyzers, `.editorconfig`, `dotnet format`; ESLint + Prettier for the frontend | built into the SDK | decided |
| Frontend framework | React 19.2 + Vite 8 | same as TypeScript stack | decided |
| Meta-framework | Next.js 16 (App Router), frontend only | same as TypeScript; ASP.NET Core owns API and auth | decided |
| Server state | TanStack Query v5 | same as TypeScript stack | decided |
| Styling | Tailwind CSS v4, after plain CSS | same as TypeScript stack | decided |
| Forms and validation | React Hook Form 7 + Zod 4 (generated); built-in validation + FluentValidation in the API | schemas come from the API contract | decided |
| API client | Orval, generated from OpenAPI 3.1 | typed hooks and Zod from one contract | decided |
| Backend runtime and framework | ASP.NET Core 10: Minimal APIs, then controllers | course; controllers for existing job codebases | decided |
| Database | SQL Server 2025 (Docker) + Azure SQL Database | course and .NET employers | decided |
| ORM or query layer | EF Core 10; Dapper for hand-written SQL | course; Dapper for tuned queries | decided |
| Cache | HybridCache + Redis 8, output caching | course: in-memory plus distributed caching | decided |
| Jobs and messaging | BackgroundService + Channels, then Hangfire; Azure Service Bus | built-in first; Hangfire is free on SQL Server | decided |
| Auth | hand-built JWT and cookie auth, then ASP.NET Core Identity | course; learn the internals first | decided |
| Testing | xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute; frontend as the TypeScript stack | real dependencies; no paid assertion libraries | decided |
| Observability | ILogger + OpenTelemetry, Aspire dashboard, Application Insights; Sentry for the frontend | course monitoring; vendor-neutral signals | decided |
| Containers | Docker + Compose (Docker Desktop, WSL2), `dotnet publish` images | same as TypeScript stack | decided |
| CI/CD | GitHub Actions | course; same as TypeScript stack | decided |
| Cloud | Azure (Container Apps, Azure SQL, Azure Managed Redis, Key Vault, Blob Storage, Service Bus) | course cloud | decided |
| Infrastructure as code | Bicep + Azure Developer CLI (azd) | Azure-native; Terraform is in the TypeScript stack | decided |
| Security tooling | rate limiting middleware, NetEscapades.AspNetCore.SecurityHeaders, NuGet Audit, Dependabot, CodeQL, gitleaks | built-in first; closes 06-security tooling gaps | decided |
| API docs | Microsoft.AspNetCore.OpenApi (OpenAPI 3.1) + Scalar | built in; Swashbuckle left the templates | decided |
| Reliability | Microsoft.Extensions.Http.Resilience (Polly 8), ASP.NET Core health checks | the official resilience stack | decided |
| Load testing | k6 + BenchmarkDotNet | k6 as in TypeScript; plus micro-benchmarks | decided |
| Integrations | Stripe.net (test mode), Azure Communication Services Email, Azure Blob Storage | payments, email, and files on Azure | decided |
| Comparison languages | TypeScript, Java, Go (reading-level examples) | TypeScript known; Java is closest to C# | decided |

Status is one of: decided, tentative, undecided.

## Topic → TECH
Exact string the learn prompt uses as TECH for each topic.
| Topic | TECH |
|:--|:--|
| modules/01-foundations/01-git | Git, GitHub |
| modules/01-foundations/02-http-networking | HTTP, ASP.NET Core 10 (Kestrel), curl, Chrome DevTools |
| modules/01-foundations/03-testing | xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute |
| modules/01-foundations/04-ci-cd | GitHub Actions, .NET 10 SDK, pnpm, Docker |
| modules/01-foundations/05-code-quality | .NET analyzers, .editorconfig, dotnet format, C# 14 (nullable) |
| modules/01-foundations/06-security | ASP.NET Core 10, rate limiting middleware, NetEscapades.AspNetCore.SecurityHeaders, NuGet Audit, Dependabot, CodeQL, gitleaks |
| modules/01-foundations/07-config-environments | ASP.NET Core configuration, Options pattern, user-secrets, Azure Key Vault, Docker Compose |
| modules/01-foundations/08-documentation | Markdown, Microsoft.AspNetCore.OpenApi (OpenAPI 3.1), Scalar, XML doc comments |
| modules/02-frontend/01-html | HTML |
| modules/02-frontend/02-css | CSS, then Tailwind CSS 4 |
| modules/02-frontend/03-javascript | JavaScript, TypeScript |
| modules/02-frontend/04-framework | React 19.2, TypeScript, Vite 8 |
| modules/02-frontend/05-state-management | React 19.2, TanStack Query 5, Orval |
| modules/02-frontend/06-rendering | Next.js 16, React 19.2 |
| modules/02-frontend/07-performance | React 19.2, Next.js 16, Vite 8, Lighthouse |
| modules/02-frontend/08-accessibility | HTML, React 19.2, axe-core, Playwright |
| modules/02-frontend/09-ux-states | React 19.2, TanStack Query 5, Tailwind CSS 4 |
| modules/02-frontend/10-forms | React Hook Form 7, Zod 4, Orval, React 19.2 |
| modules/02-frontend/11-security | React 19.2, Next.js 16, CSP |
| modules/02-frontend/12-cross-cutting | React 19.2, TypeScript, Tailwind CSS 4 |
| modules/02-frontend/13-testing-monitoring | Vitest 4, Testing Library, MSW, Playwright, Sentry |
| modules/03-backend/01-language-runtime | C# 14, .NET 10 LTS |
| modules/03-backend/02-api-design | ASP.NET Core 10 (Minimal APIs, controllers), Microsoft.AspNetCore.OpenApi, Orval |
| modules/03-backend/03-databases | SQL Server 2025, EF Core 10, Dapper, Azure SQL |
| modules/03-backend/04-auth | ASP.NET Core Identity, JWT bearer, cookie authentication, Data Protection, Redis 8 |
| modules/03-backend/05-validation-abuse | ASP.NET Core 10 validation, FluentValidation, rate limiting middleware, Redis 8 |
| modules/03-backend/06-caching | HybridCache, IMemoryCache, Redis 8, output caching |
| modules/03-backend/07-background-jobs | BackgroundService, Channels, Hangfire, Azure Service Bus |
| modules/03-backend/08-reliability | Microsoft.Extensions.Http.Resilience (Polly 8), ASP.NET Core health checks, Hangfire |
| modules/03-backend/09-scalability | ASP.NET Core 10, SQL Server 2025, Redis 8, k6, BenchmarkDotNet, YARP |
| modules/03-backend/10-observability | ILogger, OpenTelemetry, Aspire dashboard, Application Insights, Sentry |
| modules/03-backend/11-architecture | ASP.NET Core 10, C# 14, built-in DI, Mapperly |
| modules/03-backend/12-integrations | Stripe.net, Azure Communication Services Email, Azure Blob Storage, Hangfire |
| modules/04-shipping/01-containers | Docker, Docker Compose, .NET SDK containers, Aspire |
| modules/04-shipping/02-cloud | Azure (Container Apps, Azure SQL, Azure Managed Redis, Key Vault, Blob Storage, Service Bus) |
| modules/04-shipping/03-iac | Bicep, Azure Developer CLI (azd), GitHub Actions |
| modules/04-shipping/04-deployments | GitHub Actions, Docker, Azure Container Registry, Azure Container Apps, azd |
| modules/04-shipping/05-data-safety | Azure SQL backups, SQL Server 2025, EF Core migrations |
| modules/04-shipping/06-incident-response | Application Insights, Azure Monitor, Sentry |
| modules/05-practice/01-engineering-practice | Git, GitHub, GitHub Copilot |
| modules/06-design/01-paradigms-oop | C# 14 |
| modules/06-design/02-principles | C# 14 |
| modules/06-design/03-design-patterns | C# 14, ASP.NET Core 10 |
| modules/06-design/04-architecture-styles | C#, ASP.NET Core 10, Next.js 16, React 19.2 |
| modules/06-design/05-domain-driven-design | C# 14, EF Core 10, SQL Server 2025 |
| modules/06-design/06-system-design | SQL Server 2025, Redis 8, Azure Service Bus, Azure |
| modules/06-design/07-distributed-systems | SQL Server 2025, Redis 8, Azure Service Bus |
| modules/06-design/08-data-structures-algorithms | C# 14, .NET 10 collections, BenchmarkDotNet |
| modules/07-capstone/01-design-build | Next.js 16, ASP.NET Core 10, C# 14, SQL Server 2025, EF Core 10, Redis 8, Hangfire |
| modules/07-capstone/02-pre-launch | Next.js 16, ASP.NET Core 10, SQL Server 2025, Redis 8, Azure, Bicep |

## Learn order
1. 03-backend/01-language-runtime first (certificate courses 1–2): C# and .NET are new, and everything builds on them.
2. 06-design/01-paradigms-oop and 06-design/08-data-structures-algorithms alongside (courses 2 and 7): OOP in C#, and katas that build fluency.
3. 01-foundations/05, 03, 06, 07: C# tooling, tests, security, config. Skim 01-git and 02-http-networking if done in the TypeScript stack.
4. 04-shipping/01-containers, because Docker runs SQL Server and Redis for everything after.
5. 03-backend/02–05 (courses 3–5): API design, databases, auth, validation; 01-foundations/08-documentation with 02.
6. 03-backend/06 and 09 (course 6): caching, scalability, load balancing.
7. 03-backend/07, 08, 10–12: jobs, reliability, observability, architecture, integrations.
8. 02-frontend/05 and 10 against your C# API through Orval; the other frontend topics mirror the TypeScript stack.
9. 01-foundations/04-ci-cd and 04-shipping/02–06 (course 8): Azure, Bicep, deployments, data safety, incident response.
10. 06-design/02–07 alongside, as in the TypeScript stack; 05-practice alongside every module; 07-capstone last: 01-design-build, then 02-pre-launch.

## Decision log
- 2026-11-09 · Goal · .NET back-end jobs on Azure, tools of the Microsoft Back-End Developer certificate · chosen by me
- 2026-11-09 · Language · C# 14, .NET 10 LTS · course language; .NET 11 (STS) ships 2026-11-10, revisit after 11.0.x settles
- 2026-11-09 · Editor and debugger · VS Code + C# Dev Kit, Visual Studio 2026 Community · course tools; Visual Studio for profiling
- 2026-11-09 · Package manager and monorepo · NuGet + Central Package Management, .slnx; pnpm for the frontend · one versions file
- 2026-11-09 · Lint and format · .NET analyzers, .editorconfig, dotnet format · built into the SDK; CSharpier optional
- 2026-11-09 · Frontend framework, Meta-framework, Server state, Styling · same as the TypeScript stack · requested by me
- 2026-11-09 · Forms and validation · React Hook Form 7 + Zod 4 generated by Orval; built-in validation + FluentValidation · Zod cannot be shared with C#; FluentValidation is still free
- 2026-11-09 · API client · Orval · tentative; generates TanStack Query hooks and Zod schemas from OpenAPI
- 2026-11-09 · Backend runtime and framework · ASP.NET Core 10, Minimal APIs then controllers · course; controllers still dominate existing job codebases
- 2026-11-09 · Database · SQL Server 2025 + Azure SQL · chosen by me; course and .NET employers; Azure Data Studio is retired, use SSMS or VS Code mssql
- 2026-11-09 · ORM or query layer · EF Core 10, Dapper · course
- 2026-11-09 · Cache · HybridCache + Redis 8 · course; Azure Cache for Redis is retiring, use Azure Managed Redis
- 2026-11-09 · Jobs and messaging · BackgroundService + Channels, Hangfire, Azure Service Bus · tentative; MassTransit 9 is commercial
- 2026-11-09 · Auth · hand-built JWT and cookies, then ASP.NET Core Identity · course; learn the internals first
- 2026-11-09 · Testing · xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute · tentative; FluentAssertions 8+ is commercial
- 2026-11-09 · Observability · ILogger + OpenTelemetry, Aspire dashboard, Application Insights, Sentry for the frontend · tentative
- 2026-11-09 · Containers · Docker + Compose, dotnet publish images · same as the TypeScript stack
- 2026-11-09 · CI/CD · GitHub Actions · course; same as the TypeScript stack
- 2026-11-09 · Cloud · Azure (Container Apps, Azure SQL, Managed Redis, Key Vault, Blob Storage, Service Bus) · course cloud
- 2026-11-09 · Infrastructure as code · Bicep + azd · chosen by me; Terraform is already in the TypeScript stack
- 2026-11-09 · Security tooling · rate limiting middleware, NetEscapades security headers, NuGet Audit, Dependabot, CodeQL, gitleaks · tentative
- 2026-11-09 · API docs · Microsoft.AspNetCore.OpenApi + Scalar · tentative; built in since .NET 9
- 2026-11-09 · Reliability · Microsoft.Extensions.Http.Resilience (Polly 8) · tentative
- 2026-11-09 · Load testing · k6 + BenchmarkDotNet · tentative
- 2026-11-09 · Integrations · Stripe.net, Azure Communication Services Email, Azure Blob Storage · tentative
- 2026-11-09 · Architecture libraries · plain services and Mapperly · MediatR 13+ and AutoMapper 15+ are commercial
- 2026-11-09 · Comparison languages · TypeScript, Java, Go (reading-level) · tentative
- 2026-11-09 · Topic → TECH · added 06-design/08-data-structures-algorithms · requested by me; the certificate's largest course (48 h)
- 2026-11-09 · API client · Orval · set by learn prompt
- 2026-11-09 · Jobs and messaging · BackgroundService + Channels, Hangfire, Azure Service Bus · set by learn prompt
- 2026-11-09 · Testing · xUnit v3, WebApplicationFactory, Testcontainers, Shouldly, NSubstitute · set by learn prompt
- 2026-11-09 · Observability · ILogger + OpenTelemetry, Aspire dashboard, Application Insights, Sentry for the frontend · set by learn prompt
- 2026-11-09 · Security tooling · rate limiting middleware, NetEscapades security headers, NuGet Audit, Dependabot, CodeQL, gitleaks · set by learn prompt
- 2026-11-09 · API docs · Microsoft.AspNetCore.OpenApi + Scalar · set by learn prompt
- 2026-11-09 · Reliability · Microsoft.Extensions.Http.Resilience (Polly 8), health checks · set by learn prompt
- 2026-11-09 · Load testing · k6 + BenchmarkDotNet · set by learn prompt
- 2026-11-09 · Integrations · Stripe.net, Azure Communication Services Email, Azure Blob Storage · set by learn prompt
- 2026-11-09 · Comparison languages · TypeScript, Java, Go (reading-level) · set by learn prompt
