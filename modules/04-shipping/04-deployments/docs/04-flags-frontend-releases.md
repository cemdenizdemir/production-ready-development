---
title: Feature flags, frontend deploys, and release hygiene
tech: GitHub Actions, AWS ECS, AWS S3, AWS CloudFront, Next.js 16
version: Next.js 16 (standalone), S3 + CloudFront, GitHub Actions, Grafana annotations API, sentry-cli
date: 2026-11-07
covers: [9, 11, 12]
---
# Feature flags, frontend deploys, and release hygiene
[← Overview](00-overview.md)

## Why it matters
- A half-finished feature lives on a long-running branch for six weeks. Merging it causes three days of conflicts and a risky big-bang release.
- After a frontend deploy, users with the old page open click a button and get errors: the old JavaScript chunks were deleted from the CDN.
- Nobody can tell when the last production deploy happened, what it contained, or whether deploys are getting riskier over time.

## Concepts

### Deploy is not release
| Term | Meaning |
|:--|:--|
| Deploy | new code is running in production |
| Release | users can use the change |
| Feature flag | a runtime switch between the two |

| Flag type | Lifetime | Example |
|:--|:--|:--|
| Release flag | days to weeks, then deleted | `newCheckout` rolled out 1% → 10% → 100% |
| Ops flag / kill switch | permanent | `recommendationsEnabled` off under load |
| Experiment | weeks | A/B test with metrics |
| Permission flag | permanent | beta features for some accounts |

| Practice | Why |
|:--|:--|
| Owner and removal date per flag | flags are debt |
| Default to off (safe) | unknown flag or flag service down = old behavior |
| Evaluate on the server | clients can't flip release flags |
| Sticky percentage rollouts | hash the user ID, so a user doesn't flip back and forth |
| Test both paths | until the flag is removed |
| Tools | a small table or Parameter Store to start; also seen: Unleash, Flagsmith, LaunchDarkly, OpenFeature SDKs |

### Deploying the Next.js frontend
| Step | Detail |
|:--|:--|
| Build once | standalone image + static assets from the same build |
| Upload static assets first | `.next/static` to S3 (`/_next/static/…`), long immutable caching |
| Keep old assets | no `--delete`: clients on the previous version still need their chunks |
| Then roll out the image | ECS rolling deploy of the `web` service |
| Same public config everywhere | `NEXT_PUBLIC_*` is baked in at build time |
| Same server secret on every instance | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` |
| Version skew | set `deploymentId` (for example the git SHA) so Next.js can detect and recover from mismatches |
| Purge only HTML if needed | hashed assets never need invalidation |

### Release hygiene
| Practice | How |
|:--|:--|
| Version identity | git SHA (and date) for services; semver for libraries |
| Changelog | from Conventional Commits (also seen: Release Please, Changesets; [01-foundations/08-documentation](../../../01-foundations/08-documentation/README.md)) |
| Deploy markers | Grafana annotations, Sentry releases and deploys |
| Notifications | deploy started/finished/failed to the team channel |
| Deploy windows | deploy often during working hours; avoid Friday evening for risky changes |

| DORA metric | Measures | Good teams |
|:--|:--|:--|
| Deployment frequency | how often you deploy to production | on demand, many times a day |
| Lead time for changes | commit to production | less than a day |
| Change failure rate | deploys causing incidents or rollbacks | low |
| Failed deployment recovery time | time to restore after a failed deploy | less than an hour |
| Rework rate | unplanned deploys to fix production issues | low |

## Example
`src/flags/flags.ts` — a minimal server-side flag service with sticky percentage rollouts.
```ts
import { createHash } from 'node:crypto';

type Flag = { enabled: boolean; rolloutPercent: number; accounts: string[] };
type Flags = Record<string, Flag>;

let cache: { flags: Flags; loadedAt: number } = { flags: {}, loadedAt: 0 };

async function loadFlags(): Promise<Flags> {
  if (Date.now() - cache.loadedAt < 30_000) return cache.flags;            // refresh every 30 s
  try {
    cache = { flags: await flagsRepo.all(), loadedAt: Date.now() };       // a small table: name, enabled, rollout, accounts
  } catch (err) {
    logger.warn({ err }, 'flag refresh failed, keeping last known flags');  // never fail requests because of flags
  }
  return cache.flags;
}

function bucket(flagName: string, userId: string): number {
  const hash = createHash('sha256').update(`${flagName}:${userId}`).digest();
  return hash.readUInt32BE(0) % 100;                                       // 0–99, stable per user and flag
}

export async function isEnabled(flagName: string, ctx: { userId?: string; accountId?: string }): Promise<boolean> {
  const flag = (await loadFlags())[flagName];
  if (!flag?.enabled) return false;                                        // unknown or off = old behavior
  if (ctx.accountId && flag.accounts.includes(ctx.accountId)) return true;
  if (!ctx.userId) return flag.rolloutPercent >= 100;
  return bucket(flagName, ctx.userId) < flag.rolloutPercent;
}
```
Frontend deploy steps (after the `web` image is built):
```yaml
      - name: Upload static assets (keep old ones)
        run: |
          aws s3 sync .next/static "s3://shop-prod-static/_next/static" \
            --cache-control "public, max-age=31536000, immutable"
      - uses: aws-actions/amazon-ecs-deploy-task-definition@<40-char-commit-sha>
        with:
          task-definition: ${{ steps.render-web.outputs.task-definition }}
          cluster: shop-prod
          service: web
          wait-for-service-stability: true
```
`next.config.ts` excerpt:
```ts
const nextConfig = {
  output: 'standalone',
  assetPrefix: process.env.ASSET_PREFIX,          // https://static.shop.com in production
  deploymentId: process.env.GIT_SHA,              // helps Next.js detect version skew
};
export default nextConfig;
```
Deploy markers at the end of the production job:
```bash
# Grafana annotation: deploys appear as vertical lines on every dashboard
curl -sf -X POST "$GRAFANA_URL/api/annotations" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" -H "Content-Type: application/json" \
  -d "{\"tags\":[\"deploy\",\"shop-api\",\"prod\"],\"text\":\"shop-api ${GITHUB_SHA::7} deployed\"}"

# Sentry: release with commits, marked as deployed to production
sentry-cli releases new "$GITHUB_SHA"
sentry-cli releases set-commits "$GITHUB_SHA" --auto
sentry-cli releases finalize "$GITHUB_SHA"
sentry-cli releases deploys "$GITHUB_SHA" new -e production
```

## Production patterns
- **Trunk-based development with flags**: unfinished work merges early, behind a default-off flag.
- **Flags with owners and removal dates**, evaluated on the server, sticky per user, safe when the flag store fails.
- **Static assets uploaded before the new frontend rolls out**, old assets kept, hashed files cached forever.
- **Every deploy marked** in Grafana and Sentry, announced in the team channel.
- **DORA metrics tracked** to see whether delivery is getting faster and safer.

## Mistakes
Wrong: long-lived feature branches. Merge conflicts and big-bang releases. Right: small merges behind flags.

Wrong: flags that live forever. Code fills with dead branches nobody dares to delete. Right: removal date, owner, and a cleanup task when the rollout finishes.

Wrong: `aws s3 sync --delete` for frontend assets. Clients on the previous version break mid-session. Right: keep old assets; expire them with a lifecycle rule much later.

Wrong: release flags evaluated in the browser from a public config. Users can enable unfinished features. Right: evaluate on the server; send only the result.

## Check yourself
1. What's the difference between deploying and releasing, and why separate them?
2. Why must old static assets stay available after a frontend deploy?
3. Name the DORA metrics and what each measures.

<details>
<summary>Answers</summary>

1. Deploying puts new code into production; releasing makes a change available to users. Separating them with flags lets you deploy small changes continuously, release gradually to a few users first, and turn a feature off instantly without a rollback.
2. Users who loaded the page before the deploy still run the old JavaScript, which requests chunks by their old hashed names. If those files are deleted, navigation and lazy loading fail until the user reloads.
3. Deployment frequency (how often), lead time for changes (commit to production), change failure rate (share of deploys causing problems), failed deployment recovery time (how fast you recover), and rework rate (unplanned fix deploys).
</details>

## Sources
- [Martin Fowler — Feature toggles](https://martinfowler.com/articles/feature-toggles.html)
- [OpenFeature](https://openfeature.dev/)
- [Next.js — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Grafana — Annotations HTTP API](https://grafana.com/docs/grafana/latest/developers/http_api/annotations/)
- [Sentry — Releases with sentry-cli](https://docs.sentry.io/cli/releases/)
- [DORA — Four keys metrics](https://dora.dev/guides/dora-metrics-four-keys/)
