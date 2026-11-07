---
title: Server Functions, route handlers, and proxy.ts
tech: Next.js 16, React 19.2, Zod 4
version: Next.js 16.x
date: 2026-11-07
covers: [7, 10]
---
# Server Functions, route handlers, and proxy.ts
[← Overview](00-overview.md)

## Why it matters
- A Server Action deletes a project by ID without checking who calls it. Server Actions are public POST endpoints; anyone who finds the action ID can call it.
- Auth is checked only in `proxy.ts`. A matcher change skips one route, and its data is exposed.
- A route handler re-implements half the Express API inside Next.js, and now two backends must stay in sync.

## Concepts

### Server Functions (Server Actions)
- An async function marked `'use server'` (in a file or at the top of the function) runs on the server and can be called from Client Components or passed to `<form action>`.
- Next.js creates a **public POST endpoint** for each one. Treat them exactly like API routes: **authenticate, authorize, and validate input inside every action.**
- They work with progressive enhancement: a `<form action={serverAction}>` submits even before JavaScript loads.
- After a write: `updateTag`/`revalidatePath` to refresh cached data, `redirect()` to navigate, or return a result for `useActionState`.
- Built-in protections: POST only, Origin checked against Host (configure `experimental.serverActions.allowedOrigins` behind proxies), action IDs are unguessable and closures are encrypted. Not a substitute for authorization.

In this stack, Express owns business logic and auth. A Server Action is a thin layer: validate, forward to Express with the user's cookies, update the cache.

### Route handlers
`app/**/route.ts` exports functions per HTTP method (`GET`, `POST`, ...) using Web `Request`/`Response`. Use them for things the frontend server must own: webhooks that revalidate caches, OG images, BFF endpoints that combine Express calls for the browser, file downloads. Not as a second backend.

### `proxy.ts` (formerly `middleware.ts`)
- Runs **before** a request is routed, on the Node.js runtime, for paths matched by `config.matcher`.
- Good for: redirects, rewrites, setting headers (CSP nonces, [11-security](../../11-security/README.md)), locale detection, cheap optimistic auth checks (cookie present?).
- Not for: real authorization or data fetching. It can't see what a page will access, and matchers are easy to get wrong. Authorize in the data layer and in Express.

## Example
`app/projects/actions.ts`
```ts
'use server';
import { cookies } from 'next/headers';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const RenameProject = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(100),
});

type State = { error?: string };

export async function renameProject(_prev: State, formData: FormData): Promise<State> {
  const parsed = RenameProject.safeParse(Object.fromEntries(formData)); // validate: it's untrusted input
  if (!parsed.success) return { error: 'Name must be 1–100 characters.' };

  const res = await fetch(`${process.env.API_INTERNAL_URL}/projects/${parsed.data.projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: (await cookies()).toString() },
    body: JSON.stringify({ name: parsed.data.name }),
  });                                                     // Express authenticates and authorizes

  if (res.status === 401) redirect('/login');
  if (res.status === 403 || res.status === 404) return { error: 'Project not found.' };
  if (!res.ok) return { error: 'Could not rename the project. Try again.' };

  updateTag(`project:${parsed.data.projectId}`);          // read-your-writes
  return {};
}
```
`app/projects/[id]/RenameForm.tsx`
```tsx
'use client';
import { useActionState } from 'react';
import { renameProject } from '../actions';

export function RenameForm({ projectId, name }: { projectId: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject, {});
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <label>Name <input name="name" defaultValue={name} required maxLength={100} /></label>
      <button disabled={pending}>{pending ? 'Saving…' : 'Rename'}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```
`app/api/revalidate/route.ts` — let Express invalidate Next.js caches after its own changes.
```ts
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

export async function POST(request: Request) {
  const token = request.headers.get('x-revalidate-token') ?? '';
  const expected = process.env.REVALIDATE_TOKEN ?? '';
  const ok = token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { tags } = (await request.json()) as { tags: string[] };
  for (const tag of tags) revalidateTag(tag, 'max');
  return Response.json({ revalidated: tags });
}
```
`proxy.ts` — optimistic redirect only.
```ts
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (!request.cookies.has('__Host-sid')) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/account/:path*', '/projects/:path*'] };
```

## Production patterns
- **Every Server Action validates input and relies on Express for authorization**; return user-friendly errors, never stack traces.
- **Thin actions, thick API:** business rules live in Express so mobile apps and other clients get the same behavior.
- **Route handlers only for frontend-owned concerns**: cache revalidation webhooks, OG images, downloads, BFF aggregation.
- **`proxy.ts` for routing concerns** (redirects, headers, locales); real access checks stay in the data layer.
- **Set `experimental.serverActions.allowedOrigins`** when running behind a proxy that changes the Host header.

## Mistakes
Wrong: an action without authorization.
```ts
'use server';
export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } }); // anyone can call this endpoint with any id
}
```
Right: verify the session and ownership (here: Express does both when you forward cookies), and validate `id`.

Wrong: trusting `proxy.ts` as the only auth layer. Right: authorize again where data is read or written.

Wrong: building business logic in route handlers that duplicates Express. Right: call Express; keep one source of truth.

Wrong: comparing secrets with `===` in a webhook handler. Right: `timingSafeEqual` (and equal-length check).

## Check yourself
1. Why must Server Actions check authorization even though they're only called from your UI?
2. What is `proxy.ts` good for, and what shouldn't it do?
3. When is a Next.js route handler the right place for code in this stack?

<details>
<summary>Answers</summary>

1. Each action is exposed as a POST endpoint; anyone can call it directly with crafted arguments. The UI is not a security boundary.
2. Redirects, rewrites, headers (like CSP nonces), locale handling, and cheap optimistic checks. It shouldn't be the only authorization layer or fetch data for pages.
3. For concerns that belong to the frontend server: revalidating Next.js caches when Express changes data, generating OG images, file downloads, or a small BFF endpoint aggregating Express calls for the browser.
</details>

## Sources
- [Next.js — Updating data (Server Functions)](https://nextjs.org/docs/app/getting-started/updating-data)
- [Next.js — Data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js — Route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Next.js — `proxy.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [react.dev — `'use server'`](https://react.dev/reference/rsc/use-server)
