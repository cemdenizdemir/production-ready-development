---
title: Zod from OpenAPI, server errors, and keeping rules in sync
tech: Orval, Zod 4, React Hook Form 7, ASP.NET Core 10 (ValidationProblemDetails)
version: Orval 8.x, Zod 4.4, React Hook Form 7.6x
date: 2026-11-09
covers: [3, 6, 12]
---
# Zod from OpenAPI, server errors, and keeping rules in sync
[← Overview](00-overview.md)

## Why it matters
- The C# DTO allows 500 characters for a note; the hand-written frontend schema allows 1,000. Users type a long note, the API rejects it, and the form shows a generic error.
- The API returns `{"errors":{"Lines[1].Quantity":["Must be between 1 and 1000."]}}`; the frontend shows "Something went wrong" because nobody maps it to the field.
- A rule exists only on the client ("postal code must be 5 digits"); the mobile app calls the API directly and stores invalid addresses.

## Concepts

### Where rules come from
| Rule | Lives in | Reaches the frontend via |
|:--|:--|:--|
| required, length, range, regex, email, enum | C# DTO attributes (`[Required]`, `[MaxLength]`, `[Range]`, `[RegularExpression]`, `[EmailAddress]`) or FluentValidation | OpenAPI schema → Orval → Zod |
| cross-field ("delivery date after today", "billing = shipping") | FluentValidation / `IValidatableObject` | not in OpenAPI → `ValidationProblemDetails` at submit; mirror in Zod `.refine()` only if instant feedback matters |
| business rules ("coupon valid", "in stock") | domain services | server errors at submit |
| UX-only rules ("confirm password matches") | frontend only | extend the generated schema |

OpenAPI can express shapes and simple constraints, not business logic. The API is always the authority.

### Generated Zod schemas
Orval's `zod` output creates schemas per operation: request bodies, params, query, and responses (names follow operationIds, e.g. `createAddressBody`). Use them as the base and extend for UX:
```ts
import { createAddressBody } from "@/api/generated/zod/addresses";

export const addressFormSchema = createAddressBody.extend({
  postalCode: createAddressBody.shape.postalCode.trim(),     // UX normalization
});
```
FluentValidation rules don't appear in OpenAPI by default; prefer DataAnnotations for simple field constraints on request DTOs (or a schema transformer) so the contract carries them.

### ValidationProblemDetails from ASP.NET Core
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "PostalCode": ["The field PostalCode must match the regular expression '^\\d{5}$'."],
    "Lines[1].Quantity": ["The field Quantity must be between 1 and 1000."]
  },
  "traceId": "00-4f2a9c1e…-01"
}
```
Keys are property paths, often PascalCase with `[n]` indexes. React Hook Form paths are `postalCode` and `lines.1.quantity`. Map them once.

Messages: generic attribute messages are developer-speak. Set friendly messages in C# (`[Required(ErrorMessage = "Enter the city")]`, FluentValidation `.WithMessage(...)`), or map by error code on the client. Errors for unknown fields go to a form-level message.

## Example
`web/src/lib/form-errors.ts`
```ts
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/fetcher";

const toFieldPath = (key: string) =>
  key
    .replace(/\[(\d+)\]/g, ".$1")                           // Lines[1].Quantity → Lines.1.Quantity
    .split(".")
    .map((s) => s.charAt(0).toLowerCase() + s.slice(1))     // → lines.1.quantity
    .join(".");

export function applyServerErrors<T extends FieldValues>(
  error: unknown, setError: UseFormSetError<T>, knownFields: readonly string[],
): string | null {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.problem.errors) return null;
  let formLevel: string | null = null;
  for (const [key, messages] of Object.entries(error.problem.errors)) {
    const path = toFieldPath(key);
    const root = path.split(".")[0];
    if (knownFields.includes(root)) setError(path as Path<T>, { type: "server", message: messages[0] });
    else formLevel ??= messages[0];
  }
  return formLevel ?? null;
}
```
`web/src/features/account/NewAddress.tsx`
```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createAddressBody } from "@/api/generated/zod/addresses";
import { useCreateAddress } from "@/api/generated/addresses/addresses";
import { applyServerErrors } from "@/lib/form-errors";
import { messageFor } from "@/components/ui/ErrorState";

type Form = z.infer<typeof createAddressBody>;

export function NewAddress() {
  const form = useForm<Form>({ resolver: zodResolver(createAddressBody), mode: "onTouched" });
  const create = useCreateAddress();

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await create.mutateAsync({ data });
      form.reset();
    } catch (e) {
      const formLevel = applyServerErrors(e, form.setError, Object.keys(createAddressBody.shape));
      form.setError("root.server", { message: formLevel ?? messageFor(e).text });
    }
  });

  return (
    <form noValidate onSubmit={onSubmit}>
      {/* fields as in lesson 01 */}
      {form.formState.errors.root?.server && <p role="alert">{form.formState.errors.root.server.message}</p>}
      <button type="submit" disabled={form.formState.isSubmitting}>Save address</button>
    </form>
  );
}
```
C# side (for reference, 03-backend/05-validation-abuse):
```csharp
public sealed record CreateAddress(
    [property: Required(ErrorMessage = "Enter the recipient's name"), MaxLength(100)] string Name,
    [property: Required, RegularExpression(@"^\d{5}$", ErrorMessage = "Enter a 5-digit postal code")] string PostalCode);
```

## Production patterns
- Request DTO constraints in C# are the single source; Orval regenerates Zod in the same PR; CI fails on stale generated code.
- Friendly messages defined in the API (they also serve mobile clients), or a client mapping by error code.
- One `applyServerErrors` helper for every form; unknown keys become a form-level error.
- Business-rule failures (409 with `code`) shown near the submit button with specific wording.

## Mistakes
Wrong: a hand-written frontend schema with different limits than the C# DTO.
Right: generate from OpenAPI; extend only for UX.

Wrong: ignoring the `errors` dictionary on 400.
Right: map each key to the field path and `setError`.

## Check yourself
1. Which rules can't come through OpenAPI into Zod?
2. How do you convert `Lines[1].Quantity` to a React Hook Form path?
3. Why keep validation on the server if the client already validates?

<details><summary>Answers</summary>

1. Cross-field and business rules (stock, coupons, dates relative to now) and most FluentValidation rules unless exported to the schema.
2. Replace `[n]` with `.n` and camelCase each segment: `lines.1.quantity`.
3. Clients can be bypassed (direct API calls, other apps, old frontends); the API must protect its own invariants.
</details>

## Sources
- [Orval — Zod](https://orval.dev/docs/guides/zod)
- [Zod — Defining schemas](https://zod.dev/api)
- [React Hook Form — setError](https://react-hook-form.com/docs/useform/seterror)
- [ASP.NET Core — Model validation and ValidationProblemDetails](https://learn.microsoft.com/aspnet/core/mvc/models/validation)
- [RFC 9457 — Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
