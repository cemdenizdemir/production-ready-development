---
title: Config & Environments
module: 01-foundations
tech: Node.js 26 (--env-file), Zod 4, Docker Compose
---
# Config & Environments
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ Twelve-factor config: config in the environment, one build for every environment
- [ ] ⭐ Environments: local, test, preview, staging, production, and parity between them
- [ ] ⭐ Loading env vars in Node 26: `--env-file`, `--env-file-if-exists`, `process.loadEnvFile`
- [ ] ⭐ Validating config at startup with Zod and failing fast with clear errors
- [ ] Typed config object in one module; no `process.env` scattered through the code
- [ ] `.env` files, `.env.example`, and what never goes in them
- [ ] Secrets vs config: secret managers, runtime injection, rotation without downtime
- [ ] Docker Compose for local environments: services, healthchecks, profiles, overrides
- [ ] Feature flags and runtime config vs build-time config
- [ ] Frontend config: public vs private values, build-time inlining (`VITE_`, `NEXT_PUBLIC_`)
- [ ] Changing config safely: defaults, deprecations, reviews, and audit trails

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Twelve-factor config, environments, and Compose](docs/01-twelve-factor-and-environments.md)
- [02 · Env vars and validated config in Node 26](docs/02-env-vars-and-validation.md)
- [03 · Secrets, flags, frontend config, and safe changes](docs/03-secrets-flags-frontend.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/01-foundations/07-config-environments mode=tasks` when you are ready to build._
