---
title: Pre-Launch Checklist
module: 07-capstone
tech: Next.js 16, ASP.NET Core 10, SQL Server 2025, Redis 8, Azure, Bicep
---
# Pre-Launch Checklist
[← Dashboard](../../../README.md)

## Checklist
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

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Security and privacy review](docs/01-security-privacy-review.md)
- [02 · Reliability, data safety, observability, and operations](docs/02-reliability-data-observability-ops.md)
- [03 · Performance, accessibility, and SEO](docs/03-performance-accessibility-seo.md)
- [04 · Infrastructure, code health, and the launch plan](docs/04-infrastructure-code-launch.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn csharp/07-capstone/02-pre-launch mode=tasks` to turn the milestones into tasks._
