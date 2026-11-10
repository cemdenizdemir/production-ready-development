---
id: T01
title: Repo bootstrap
level: core
status: todo
covers: [2, 4, 13, 14]
---
# T01 · Repo bootstrap
[← Topic](../../README.md) · Lessons: [01](../../docs/01-objects-and-commits.md), [02](../../docs/02-repo-setup-and-secrets.md), [06](../../docs/06-signing-and-releases.md)

## Scenario
You are the first engineer on a new Node.js + TypeScript service. Five people clone it next week, on Windows/WSL2 and macOS. Set it up so the usual mistakes (CRLF scripts, committed `.env` files, "fix stuff" commits, unsigned commits) are blocked before anyone makes them.

## Requirements
- [ ] Global Git config in WSL2 covering: identity with your GitHub no-reply email, `init.defaultBranch`, `pull.rebase`, `push.autoSetupRemote`, `push.useForceIfIncludes`, `fetch.prune`, `merge.conflictStyle zdiff3`, `rerere.enabled`, `rebase.autoSquash`, `rebase.updateRefs`, and a global excludes file.
- [ ] SSH commit and tag signing turned on, with an `allowed_signers` file so `git verify-commit` works locally.
- [ ] `gitconfig.txt`: output of `git config --global --list --show-origin`, with anything private redacted.
- [ ] `.gitignore` for a Node/TS/Docker project. `.env` and `.env.*` ignored, `.env.example` tracked.
- [ ] `.env.example` with at least three placeholder variables (`DATABASE_URL`, `SESSION_SECRET`, `PORT`).
- [ ] `.gitattributes` that stores text as LF, keeps `.ps1`/`.cmd` as CRLF, and marks images and fonts as binary.
- [ ] `.githooks/commit-msg` (POSIX `sh`) that rejects messages that are not Conventional Commits.
- [ ] `.githooks/pre-commit` (POSIX `sh`) that rejects: staged `.env` files (not `.env.example`), staged files over 1 MB, and staged content containing a private-key header (`-----BEGIN ... PRIVATE KEY-----`).
- [ ] `SETUP.md`: the commands a new teammate runs after cloning (hooks path, executable bits, signing), max 20 lines.
- [ ] `EVIDENCE.md`: terminal output proving each acceptance criterion below, from a sandbox repo where you installed these files.

## Acceptance criteria
- `git commit -m "fixed stuff"` exits non-zero and prints the expected format.
- These messages are accepted: `feat(api): add health endpoint`, `fix: handle empty cart`, `feat!: drop Node 24 support`, `revert: feat(api): add health endpoint`.
- Messages Git generates are accepted: `Merge branch 'x'`, `fixup! feat(api): add health endpoint`, `squash! ...`, `amend! ...`.
- A subject over 72 characters is rejected.
- Staging `.env` or `config/.env.local` and committing is rejected; `.env.example` is allowed.
- Staging a 2 MB file is rejected with its name and size in the message.
- Staging a file containing a private-key header is rejected, without printing the key.
- `git check-ignore -v .env` matches a rule; `git check-ignore .env.example` prints nothing.
- `git check-attr eol -- scripts/run.sh` prints `lf`; `git check-attr eol -- tools/setup.ps1` prints `crlf`.
- `git log --show-signature -1` shows a good signature; `git verify-commit HEAD` exits 0.
- Both hooks keep their executable bit in Git (`git ls-files -s .githooks` shows mode `100755`).

## Constraints
- Git 2.56 in WSL2 (SSH signing needs 2.34+). GitHub for the no-reply email and signing key.
- Plain Git hooks with `core.hooksPath`. No husky, lefthook, commitlint, or other packages: they are not in STACK.md.
- Hooks are POSIX `sh` (they must run on WSL2, macOS, and Git Bash). No `bash`-only syntax.
- **Never commit real or realistic key material**, not even in tests: GitHub push protection will block this repo. Generate test keys at test time in the sandbox (`ssh-keygen -t ed25519 -N "" -f /tmp/k`) and don't copy them here.
- Deliverables live in this folder. Test them in a sandbox repo outside this one (for example `~/sandbox/t01`).

## Covers
- Atomic commits with clear messages (Conventional Commits)
- Repo setup: global config, `.gitignore`, `.gitattributes` line endings, hooks
- Keeping secrets out of Git, and responding when one leaks
- Signed commits and tags (SSH signing, verified badge)

## Hints
<details>
<summary>1. Testing hooks fast</summary>

The `commit-msg` hook receives one argument: the path to the message file. You can run it directly: `printf 'fix: x\n' > /tmp/m && .githooks/commit-msg /tmp/m; echo $?`. Strip comment lines (`#`) before checking, since `git commit -v` adds them.
</details>

<details>
<summary>2. Only check what is staged</summary>

`git diff --cached --name-only --diff-filter=ACM` lists staged files. For content, check the staged version, not the working-tree file: `git show ":$file"`. For size, `git cat-file -s ":$file"`.
</details>

<details>
<summary>3. Line endings that already exist</summary>

After adding `.gitattributes` to a sandbox repo with existing files, `git add --renormalize .` re-applies the rules. `git ls-files --eol` shows what Git stored versus what is in your working tree.
</details>

<details>
<summary>4. Signing problems</summary>

`error: Load key ... invalid format` usually means `user.signingkey` points to the private key file or a wrong path. Point it at the `.pub` file. "No principal matched" on verify means the email in `allowed_signers` doesn't match the commit's committer email.
</details>

## Stretch
- Make `commit-msg` also reject a `feat`/`fix` subject that starts with an uppercase letter or ends with a full stop, and print a corrected suggestion.
- Add an `[includeIf "gitdir:~/work/"]` block that switches email and signing key for client repos, and prove it with `git config --show-origin user.email` in two folders.

## When done
Write your code in this folder, set `status: done`, and run `/review typescript/01-foundations/01-git T01`.
