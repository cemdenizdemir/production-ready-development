---
title: Dynamic fields, controlled inputs, and uploads
tech: React Hook Form 7, Zod 4, Azure Blob Storage (SAS upload)
version: React Hook Form 7.6x, Zod 4.4
date: 2026-11-09
covers: [4, 5, 10]
---
# Dynamic fields, controlled inputs, and uploads
[← Overview](00-overview.md)

## Why it matters
- A gift order lets customers add several recipients; removing the second recipient shifts the third one's errors to the wrong row.
- A third-party date picker is wired with `register`; its value never reaches the form and the delivery date is always empty.
- A 40 MB product photo upload goes through the Next.js server and the API; both hit their body size limits and the user waits two minutes for an error.

## Concepts

### Field arrays
`useFieldArray` manages lists of fields (recipients, order lines, ingredient lists).
| API | Use |
|:--|:--|
| `fields` | items to render; ⭐ use `field.id` as the React key (not the index) |
| `append(value)` / `prepend` / `insert(i, value)` | add |
| `remove(i)` | remove |
| `move(from, to)` / `swap` | reorder |
| `replace(values)` | replace all |
| `register(\`recipients.${i}.email\`)` | fields inside items |
| schema | `z.array(recipient).min(1).max(10)` |

### Controlled third-party inputs
Components that don't expose a native input (date pickers, comboboxes, rich selects) use `Controller` or `useController`:
```tsx
<Controller name="deliveryDate" control={control} render={({ field, fieldState }) => (
  <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}
    aria-invalid={fieldState.invalid} />
)} />
```
Pass `ref` so RHF can focus the field on errors. Prefer native inputs (`<input type="date">`) when they're good enough.

### File uploads
| Approach | Flow | Use |
|:--|:--|:--|
| ⭐ direct-to-storage with SAS | 1. ask API for an upload URL; 2. PUT the file to Azure Blob Storage; 3. tell the API it's done | images, documents, anything large |
| through the API (`multipart/form-data`) | browser → Next.js/API → storage | small files (< a few MB), simple cases |

Direct uploads keep large bodies off Kestrel and Next.js (body size limits, memory, timeouts). The API issues a short-lived **write-only SAS URL** for one blob name it chooses, then validates the uploaded file (size, type by magic bytes, malware scan) before using it (03-backend/12-integrations, 01-foundations/06-security).

Client-side checks are UX only: `accept="image/png,image/jpeg"`, max size, image dimensions. Upload progress needs `XMLHttpRequest` (`upload.onprogress`); `fetch` has no upload progress events.

## Example
`web/src/features/gifts/GiftRecipients.tsx`
```tsx
"use client";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  recipients: z.array(z.object({ name: z.string().min(1, "Enter a name"), email: z.email("Enter a valid email") }))
    .min(1, "Add at least one recipient").max(10),
});
type Form = z.infer<typeof schema>;

export function GiftRecipients() {
  const { control, register, handleSubmit, formState: { errors } } =
    useForm<Form>({ resolver: zodResolver(schema), defaultValues: { recipients: [{ name: "", email: "" }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "recipients" });

  return (
    <form noValidate onSubmit={handleSubmit(console.log)}>
      <fieldset>
        <legend>Recipients</legend>
        {fields.map((field, i) => (
          <div key={field.id} className="grid gap-2">
            <label htmlFor={`r-${field.id}-name`}>Name</label>
            <input id={`r-${field.id}-name`} {...register(`recipients.${i}.name`)} />
            {errors.recipients?.[i]?.name && <p>{errors.recipients[i]?.name?.message}</p>}
            <label htmlFor={`r-${field.id}-email`}>Email</label>
            <input id={`r-${field.id}-email`} type="email" {...register(`recipients.${i}.email`)} />
            <button type="button" onClick={() => remove(i)} disabled={fields.length === 1}>Remove recipient {i + 1}</button>
          </div>
        ))}
      </fieldset>
      {errors.recipients?.root && <p role="alert">{errors.recipients.root.message}</p>}
      <button type="button" onClick={() => append({ name: "", email: "" })} disabled={fields.length >= 10}>Add recipient</button>
      <button type="submit">Continue</button>
    </form>
  );
}
```
`web/src/lib/upload.ts` (direct upload to Blob Storage with progress)
```ts
export async function uploadProductImage(file: File, onProgress: (pct: number) => void): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");

  // 1. API returns a short-lived, write-only SAS URL for a blob name it chose
  const { uploadUrl, blobName } = await apiFetch<{ uploadUrl: string; blobName: string }>(
    "/admin/product-images/upload-url", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }) });

  // 2. PUT straight to Azure Blob Storage
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status === 201 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  // 3. tell the API; it validates and attaches the image
  await apiFetch(`/admin/product-images/${encodeURIComponent(blobName)}/complete`, { method: "POST" });
  return blobName;
}
```
The storage account needs CORS rules allowing `PUT` from the shop's origin for SAS uploads.

## Production patterns
- `field.id` keys in field arrays; labels and IDs derived from it so errors stay attached to the right row.
- `Controller` only for non-native inputs, always forwarding `ref` and `onBlur`.
- Large files go directly to Blob Storage with SAS; the API chooses names, limits size and type in the SAS policy, and validates after upload.
- Accessible upload UI: a real `<input type="file">` with a label, a progress element (`<progress value max>`), and status announcements.

## Mistakes
Wrong: index keys in field arrays.
```tsx
{fields.map((f, i) => <Row key={i} />)}       // removing a row shifts state and errors
```
Right: `key={f.id}`.

Wrong: posting big files through Next.js Server Actions and the API.
Right: SAS URL from the API, direct upload, then a "complete" call.

## Check yourself
1. Why must field array rows use `field.id` as the key?
2. What does `Controller` give a third-party date picker?
3. Why can't you show upload progress with `fetch`?

<details><summary>Answers</summary>

1. Index keys make React reuse DOM and state for the wrong row after removals or reorders; `field.id` is stable per item.
2. The form value, `onChange`/`onBlur` handlers, a `ref` for focusing, and field state (errors, touched) without a native input.
3. `fetch` exposes no upload progress events; `XMLHttpRequest.upload.onprogress` does.
</details>

## Sources
- [React Hook Form — useFieldArray](https://react-hook-form.com/docs/usefieldarray)
- [React Hook Form — Controller](https://react-hook-form.com/docs/usecontroller/controller)
- [Azure Blob Storage — Put Blob REST API](https://learn.microsoft.com/rest/api/storageservices/put-blob)
- [Azure — Create a user delegation SAS](https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-dotnet)
- [MDN — XMLHttpRequest upload progress](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/upload)
