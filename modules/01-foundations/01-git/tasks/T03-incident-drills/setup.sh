#!/usr/bin/env bash
# Builds the T03 sandbox: a protected bare "origin" and a clone with four incidents.
# Usage: bash setup.sh [target-dir]        default: ~/sandbox/git-t03
# Needs: Git 2.28+, Node.js 22.18+ (runs .ts tests with type stripping).
set -euo pipefail

target="${1:-$HOME/sandbox/git-t03}"
if [ -e "$target" ]; then
  echo "error: $target already exists. Delete it or pass another path." >&2
  exit 1
fi
mkdir -p "$target/.no-hooks"
cd "$target"
target="$(pwd)"
nohooks="$target/.no-hooks"

g() { git -c core.hooksPath="$nohooks" -c commit.gpgSign=false -c tag.gpgSign=false "$@"; }

# Commits get spread-out dates and rotating teammates, like a real repo.
n=0
authors=("Dana Kim <dana@example.com>" "Lee Okafor <lee@example.com>" "Sam Rivera <sam@example.com>")
commit() { # commit "<message>" [author-index]
  n=$((n + 1))
  local who="${authors[${2:-$((n % 3))}]}"
  local name="${who% <*}" email="${who#*<}"
  email="${email%>}"
  local when
  when="$(printf '2026-09-%02d %02d:15:00 +0000' $((1 + n / 3)) $((9 + (n % 3) * 3)))"
  g add -A
  GIT_AUTHOR_NAME="$name" GIT_AUTHOR_EMAIL="$email" \
  GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$email" \
  GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" \
    g commit -q -m "$1"
}
note() { printf '%s\n' "$2" >> "$1"; commit "$3"; }   # note <file> <line> <message>

git init -q --bare -b main origin.git
git -C origin.git config receive.denyNonFastForwards true   # like a protected branch
git -C origin.git config receive.denyDeletes true
git clone -q origin.git app 2>/dev/null
cd app
git config user.name >/dev/null || git config user.name "You"
git config user.email >/dev/null || git config user.email "you@example.com"
mkdir -p src test docs

# ---------- c1: v1.0.0 ----------
printf '* text=auto eol=lf\n' > .gitattributes
cat > package.json <<'EOF'
{
  "name": "shop-utils",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
EOF
printf '# shop-utils\n\nText, slug, price, and checkout helpers.\n' > README.md
cat > src/text.ts <<'EOF'
// Strip accents: "Creme brulee" with accents -> plain ASCII
export function normalize(input: string): string {
  return input.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}
EOF
cat > src/slug.ts <<'EOF'
import { normalize } from './text.ts';

export function slugify(input: string): string {
  return normalize(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
EOF
cat > src/format.ts <<'EOF'
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
EOF
cat > src/checkout.ts <<'EOF'
export function canCheckout(cartTotal: number, express = false): boolean {
  if (express) return true;
  return cartTotal > 0;
}
EOF
cat > test/slug.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.ts';

test('slugifies words', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('strips accents', () => {
  assert.equal(slugify('Crème brûlée'), 'creme-brulee');
});
EOF
cat > test/checkout.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCheckout } from '../src/checkout.ts';

test('empty cart cannot check out', () => {
  assert.equal(canCheckout(0), false);
});

test('express checkout skips the cart check', () => {
  assert.equal(canCheckout(0, true), true);
});
EOF
commit "chore: initial project" 0
g tag -a v1.0.0 -m "v1.0.0"

# ---------- c2..c40 ----------
note CONTRIBUTING.md "Open a PR against main. Keep PRs small." "docs: add contributing guide"
cat > src/format.ts <<'EOF'
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
EOF
commit "feat(format): add currency option to formatPrice"
cat > test/format.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../src/format.ts';

test('formats USD by default', () => {
  assert.equal(formatPrice(12.5), '$12.50');
});

test('formats other currencies', () => {
  assert.match(formatPrice(12.5, 'EUR'), /12\.50/);
});
EOF
commit "test(format): cover EUR formatting"
printf 'root = true\n\n[*]\nend_of_line = lf\nindent_size = 2\n' > .editorconfig
commit "chore: add editorconfig"
note README.md $'\n## Usage\n\n`slugify(\'Hello World\')` returns `hello-world`.' "docs(readme): add usage examples"
cat > src/checkout.ts <<'EOF'
export const MIN_ORDER = 5;

export function canCheckout(cartTotal: number, express = false): boolean {
  if (express) return true;
  return cartTotal >= MIN_ORDER;
}
EOF
commit "feat(checkout): add minimum order amount"
cat >> test/checkout.test.ts <<'EOF'

test('enforces the minimum order', () => {
  assert.equal(canCheckout(4.99), false);
  assert.equal(canCheckout(5), true);
});
EOF
commit "test(checkout): cover minimum order amount"
cat > src/format.ts <<'EOF'
const currencyFormat = (currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency });

export function formatPrice(amount: number, currency = 'USD'): string {
  return currencyFormat(currency).format(amount);
}
EOF
commit "refactor(format): extract formatter helper"
note docs/architecture.md "Pure functions only. No I/O in src/." "docs: add architecture notes"
cat >> src/text.ts <<'EOF'

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 3)}...`;
}
EOF
commit "feat(text): add truncate helper"
{ printf "// slugify('Hello World!') -> 'hello-world'\n"; cat src/slug.ts; } > src/slug.tmp && mv src/slug.tmp src/slug.ts
commit "docs(slug): add usage comment"
cat > test/text.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truncate } from '../src/text.ts';

test('truncates long text', () => {
  assert.equal(truncate('abcdefghij', 6), 'abc...');
  assert.equal(truncate('abc', 6), 'abc');
});
EOF
commit "test(text): cover truncate"
sed -i.bak 's/"name": "shop-utils",/"name": "shop-utils", "description": "Shop helpers",/' package.json && rm package.json.bak
commit "chore: add package description"
cat >> src/format.ts <<'EOF'

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent' }).format(ratio);
}
EOF
commit "feat(format): add formatPercent"
note docs/ops.md "# Runbook" "docs(ops): add runbook skeleton"
cat >> test/format.test.ts <<'EOF'

import { formatPercent } from '../src/format.ts';

test('formats percentages', () => {
  assert.equal(formatPercent(0.25), '25%');
});
EOF
commit "test(format): cover formatPercent"
note docs/ops.md "Run tests: node --test" "chore: document test command"

# c19: breaks the build (missing brace) until c22
cat >> src/text.ts <<'EOF'

export function normalizeQuery(input: string): string {
  return normalize(input).toLowerCase();
EOF
commit "refactor(text): add normalizeQuery for search" 1
note docs/ops.md "## Deploy: tag main, CI deploys the tag." "docs(ops): add deploy steps"
note CONTRIBUTING.md "Run node --test before you push." "docs: ask for tests before push"
printf '}\n' >> src/text.ts
commit "fix(text): add missing brace in normalizeQuery" 1

cat > src/search.ts <<'EOF'
import { normalizeQuery } from './text.ts';

export function matches(haystack: string, query: string): boolean {
  return normalizeQuery(haystack).includes(normalizeQuery(query));
}
EOF
commit "feat(search): add search helper"
cat > test/search.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../src/search.ts';

test('matches ignoring case and accents', () => {
  assert.equal(matches('Crème Brûlée', 'creme'), true);
});
EOF
commit "test(search): cover search helper"
note docs/ops.md "## Rollback: redeploy the previous tag." "docs(ops): add rollback steps"
cat > src/slug.ts <<'EOF'
import { normalize } from './text.ts';

// slugify('Hello World!') -> 'hello-world'
const NON_ALNUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export function slugify(input: string): string {
  return normalize(input).toLowerCase().replace(NON_ALNUM, '-').replace(EDGE_DASHES, '');
}
EOF
commit "perf(slug): precompile regular expressions" 0
note README.md $'\n`matches(\'Cr\\u00e8me\', \'creme\')` returns `true`.' "docs(readme): document search"
printf '26\n' > .nvmrc
commit "chore: add .nvmrc"
cat >> src/format.ts <<'EOF'

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}
EOF
commit "feat(format): add compact notation"
cat >> test/format.test.ts <<'EOF'

import { formatCompact } from '../src/format.ts';

test('formats compact numbers', () => {
  assert.equal(formatCompact(1500), '1.5K');
});
EOF
commit "test(format): cover compact notation"

# c31: the regression
cat > src/slug.ts <<'EOF'
import { normalize } from './text.ts';

// slugify('Hello World!') -> 'hello-world'
const NON_ALNUM = /[^a-z0-9]/g;
const LEADING_DASHES = /^-+/;

export function slugify(input: string): string {
  return normalize(input).toLowerCase().replace(NON_ALNUM, '-').replace(LEADING_DASHES, '');
}
EOF
commit "refactor(slug): simplify separator handling" 2
note docs/ops.md "## On-call: see the team calendar." "docs(ops): add on-call contacts"
cat >> src/checkout.ts <<'EOF'

export const FREE_SHIPPING_FROM = 50;

export function shippingCost(total: number): number {
  return total >= FREE_SHIPPING_FROM ? 0 : 4.95;
}
EOF
commit "feat(checkout): add free shipping threshold"
cat >> test/checkout.test.ts <<'EOF'

import { shippingCost } from '../src/checkout.ts';

test('ships free from the threshold', () => {
  assert.equal(shippingCost(49.99), 4.95);
  assert.equal(shippingCost(50), 0);
});
EOF
commit "test(checkout): cover free shipping threshold"
note docs/changelog-draft.md "- search helper, compact numbers, free shipping" "docs: start changelog draft"
note docs/changelog-draft.md "- minimum order amount" "docs: update changelog draft"
cat > src/checkout.ts <<'EOF'
export const MIN_ORDER = 5;
export const FREE_SHIPPING_FROM = 50;
export const EXPRESS_DEFAULT = false;

export function canCheckout(cartTotal: number, express = EXPRESS_DEFAULT): boolean {
  if (express) return true;
  return cartTotal >= MIN_ORDER;
}

export function shippingCost(total: number): number {
  return total >= FREE_SHIPPING_FROM ? 0 : 4.95;
}
EOF
commit "refactor(checkout): group constants"

# c38: the bad deploy
sed -i.bak 's/EXPRESS_DEFAULT = false/EXPRESS_DEFAULT = true/' src/checkout.ts && rm src/checkout.ts.bak
commit "feat(checkout): enable express checkout by default" 1
note README.md $'\nExpress checkout is on by default.' "docs(checkout): document express checkout"
sed -i.bak 's/"version": "1.0.0"/"version": "1.4.0"/' package.json && rm package.json.bak
commit "chore(release): prepare 1.4.0"

g push -q -u origin main --follow-tags 2>/dev/null

# ---------- Drill A: lost work (local only) ----------
git switch -q -c feat/report
for part in header rows totals; do
  echo "export const report_${part} = '${part}';" >> src/report.ts
  g add src/report.ts && g commit -q -m "feat(report): add ${part}"
done
g reset -q --hard HEAD~3

git switch -q -c spike/cache main
echo "export const cache = new Map<string, string>();" > src/cache.ts
g add src/cache.ts && g commit -q -m "spike: in-memory cache"
echo "export const TTL_SECONDS = 60;" >> src/cache.ts
g commit -q -am "spike: add ttl"
git switch -q main
g branch -q -D spike/cache

echo "export const RATE_LIMIT_PER_MINUTE = 60;" > src/rate-limit.ts
echo "// TODO: apply rate limit in checkout" >> src/checkout.ts
g stash push -q -u -m "wip: rate limiter idea"
g stash drop -q

# ---------- Drill D: secret in unpushed commits ----------
git switch -q -c feat/payments main
cat > src/payments.ts <<'EOF'
const BASE_URL = 'https://payments.example.com/v1';

export async function createCharge(amountCents: number): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/charges`, {
    method: 'POST',
    body: JSON.stringify({ amount: amountCents }),
  });
  return res.json();
}
EOF
g add . && g commit -q -m "feat(payments): add charge client"
cat > src/payments.ts <<'EOF'
const BASE_URL = 'https://payments.example.com/v1';

const API_KEY = 'demo_live_4f9c2a7e1b8d6053';

export async function createCharge(amountCents: number): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/charges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountCents }),
  });
  return res.json();
}
EOF
g commit -q -am "feat(payments): authenticate requests"
cat > test/payments.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharge } from '../src/payments.ts';

test('posts the amount in cents', async () => {
  let sent = '';
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    sent = init.body;
    return { json: async () => ({ ok: true }) };
  }) as unknown as typeof fetch;
  await createCharge(500);
  assert.equal(JSON.parse(sent).amount, 500);
});
EOF
g add . && g commit -q -m "test(payments): check request body"
sed -i.bak "s|^const BASE_URL = .*|const BASE_URL = process.env.PAYMENTS_BASE_URL ?? 'https://payments.example.com/v1';|" src/payments.ts && rm src/payments.ts.bak
g commit -q -am "refactor(payments): read base url from env"
git switch -q main

cat <<EOF

Sandbox ready: $target
  origin.git  bare remote; rejects force pushes and branch deletes (like a ruleset)
  app/        your clone. Work here.

Next: cd "$target/app" && git log --oneline --graph --all | head -20
EOF
