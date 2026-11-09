#!/usr/bin/env bash
# Builds the T02 sandbox: a bare "origin", your clone (alice), a teammate's clone (bob).
# Usage: bash setup.sh [target-dir]        default: ~/sandbox/git-t02
# Needs: Git 2.28+, Node.js 22.18+ (runs .ts tests with type stripping).
set -euo pipefail

target="${1:-$HOME/sandbox/git-t02}"
if [ -e "$target" ]; then
  echo "error: $target already exists. Delete it or pass another path." >&2
  exit 1
fi
mkdir -p "$target/.no-hooks"
cd "$target"
target="$(pwd)"
nohooks="$target/.no-hooks"

# Scripted commits ignore your hooks and signing; your own work later uses them.
g() { git -c core.hooksPath="$nohooks" -c commit.gpgSign=false "$@"; }
commit() { g commit -q -m "$1"; }

git init -q --bare -b main origin.git
git clone -q origin.git alice 2>/dev/null
cd alice
git config user.name >/dev/null || git config user.name "You"
git config user.email >/dev/null || git config user.email "you@example.com"

# ---------- main: initial project ----------
cat > package.json <<'EOF'
{
  "name": "shop-pricing",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
EOF
cat > README.md <<'EOF'
# shop-pricing

Price calculations for the shop.

## Instalation

Run the tests with `node --test` (Node.js 22.18+).
EOF
printf '* text=auto eol=lf\n' > .gitattributes
g add . && commit "chore: initial project"

mkdir -p src test
cat > src/price.ts <<'EOF'
export const TAX_RATE = 0.2;

export function priceWithTax(net: number): number {
  return Math.round(net * (1 + TAX_RATE) * 100) / 100;
}
EOF
g add . && commit "feat(pricing): add price with tax"

cat > test/price.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceWithTax } from '../src/price.ts';

test('adds tax', () => {
  assert.equal(priceWithTax(10), 12);
});
EOF
g add . && commit "test(pricing): cover tax calculation"
g push -q -u origin main 2>/dev/null

# ---------- your messy feature branch ----------
git switch -q -c feat/discount-codes

# 1. wip: half the feature + an unrelated README typo fix
cat > src/discount.ts <<'EOF'
const CODE = /^SAVE(\d{1,2})$/;

export function parseDiscountCode(code: string): number {
  const match = CODE.exec(code.trim().toUpperCase());
  if (!match) throw new Error(`Invlaid discount code: ${code}`);
  return Number(match[1]) / 100;
}
EOF
sed -i.bak 's/Instalation/Installation/' README.md && rm README.md.bak
g add . && commit "wip"

# 2. more: finish parsing, apply discount in price
cat > src/discount.ts <<'EOF'
// Codes look like SAVE10 or SAVE25: SAVE + whole percent from 1 to 90
const CODE = /^SAVE(\d{1,2})$/;

export function parseDiscountCode(code: string): number {
  const match = CODE.exec(code.trim().toUpperCase());
  if (!match) throw new Error(`Invlaid discount code: ${code}`);
  const percent = Number(match[1]);
  if (percent < 1 || percent > 90) throw new Error(`Invalid discount code: ${code}`);
  return percent / 100;
}
EOF
cat > src/price.ts <<'EOF'
export const TAX_RATE = 0.2;

export function priceWithTax(net: number, discount = 0): number {
  return Math.round(net * (1 - discount) * (1 + TAX_RATE) * 100) / 100;
}
EOF
g add . && commit "more"

# 3. fix typo
sed -i.bak 's/Invlaid/Invalid/' src/discount.ts && rm src/discount.ts.bak
g add . && commit "fix typo"

# 4. add tests (one expectation is wrong)
cat > test/discount.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiscountCode } from '../src/discount.ts';

test('parses SAVE codes', () => {
  assert.equal(parseDiscountCode('SAVE10'), 0.1);
  assert.equal(parseDiscountCode(' save25 '), 0.52);
});

test('rejects unknown and out-of-range codes', () => {
  assert.throws(() => parseDiscountCode('FREE'), /Invalid discount code/);
  assert.throws(() => parseDiscountCode('SAVE0'), /Invalid discount code/);
  assert.throws(() => parseDiscountCode('SAVE95'), /Invalid discount code/);
});
EOF
cat >> test/price.test.ts <<'EOF'

test('applies a discount before tax', () => {
  assert.equal(priceWithTax(40, 0.25), 36);
});
EOF
g add . && commit "add tests"

# 5. oops
sed -i.bak 's/0\.52/0.25/' test/discount.test.ts && rm test/discount.test.ts.bak
g add . && commit "oops"

# 6. debug line that must not ship
cat > src/discount.ts <<'EOF'
// Codes look like SAVE10 or SAVE25: SAVE + whole percent from 1 to 90
const CODE = /^SAVE(\d{1,2})$/;

export function parseDiscountCode(code: string): number {
  console.log('DEBUG parseDiscountCode', code);
  const match = CODE.exec(code.trim().toUpperCase());
  if (!match) throw new Error(`Invalid discount code: ${code}`);
  const percent = Number(match[1]);
  if (percent < 1 || percent > 90) throw new Error(`Invalid discount code: ${code}`);
  return percent / 100;
}
EOF
g add . && commit "console.log debugging"

g push -q -u origin feat/discount-codes 2>/dev/null

# ---------- bob: teammate pushes to main and to your branch ----------
cd "$target"
git clone -q origin.git bob 2>/dev/null
cd bob
git config user.name "Bob Teammate"
git config user.email "bob@example.com"

cat > src/money.ts <<'EOF'
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
EOF
cat > src/price.ts <<'EOF'
import { roundCents } from './money.ts';

export const TAX_RATE = 0.2;

export function priceWithTax(net: number): number {
  return roundCents(net * (1 + TAX_RATE));
}
EOF
g add . && commit "refactor(pricing): extract roundCents helper"

cat > src/price.ts <<'EOF'
import { roundCents } from './money.ts';

// Standard rate from 2026-01-01 (finance ticket FIN-88)
export const TAX_RATE = 0.21;

export function priceWithTax(net: number): number {
  return roundCents(net * (1 + TAX_RATE));
}
EOF
sed -i.bak 's/priceWithTax(10), 12)/priceWithTax(10), 12.1)/' test/price.test.ts && rm test/price.test.ts.bak
g add . && commit "fix(pricing): apply 21% tax rate"
g push -q origin main 2>/dev/null

git switch -q feat/discount-codes
cat >> README.md <<'EOF'

## Discount codes

`parseDiscountCode('SAVE10')` returns `0.1`. Codes go from SAVE1 to SAVE90.
EOF
g add . && commit "docs(readme): document discount codes"
g push -q origin feat/discount-codes 2>/dev/null

# ---------- alice: uncommitted work in progress ----------
cd "$target/alice"
cat >> src/discount.ts <<'EOF'

// TODO: support fixed-amount codes like OFF5
EOF
echo "Ideas: fixed-amount codes, expiry dates." > scratch.md

cat <<EOF

Sandbox ready: $target
  origin.git  bare remote (stands in for GitHub)
  alice/      YOUR clone. Work here. Do not fetch until the task says so.
  bob/        teammate's clone. Read-only for you.

Next: cd "$target/alice" && git status && git log --oneline --graph --all
EOF
