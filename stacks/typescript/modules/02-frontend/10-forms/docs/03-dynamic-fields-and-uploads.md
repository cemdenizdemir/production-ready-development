---
title: Dynamic fields, controlled inputs, and uploads
tech: React Hook Form 7, Zod 4, React 19.2
version: React Hook Form 7.6x, Zod 4.4
date: 2026-11-07
covers: [4, 5, 10]
---
# Dynamic fields, controlled inputs, and uploads
[← Overview](00-overview.md)

## Why it matters
- Invoice line items use the array index as `key`; removing the second line leaves the third line's values in the wrong inputs.
- A third-party date picker is registered like a native input; it never reports changes, so the submitted date is always empty.
- A 200 MB video upload shows no progress; users assume it froze and reload, losing it at 90%.

## Concepts

### Field arrays
`useFieldArray({ control, name: 'items' })` manages repeating groups.

| Returns | Use |
|:--|:--|
| `fields` | items to render; each has a stable `id`: use it as `key` |
| `append(obj)` / `prepend` / `insert(i, obj)` | add rows (always full objects with defaults) |
| `remove(i)` / `move(a, b)` / `swap(a, b)` / `update(i, obj)` / `replace(arr)` | change rows |

Register nested fields with dotted paths: `` register(`items.${index}.qty`) ``. Validate the array in Zod (`z.array(Item).min(1)`), including cross-row rules with `refine`.

### Controlled third-party inputs
Some components don't expose a native input (date pickers, rich selects, sliders, editors). Wrap them in `Controller` (or `useController`), which passes `value`, `onChange`, `onBlur`, and `ref`. Pass `field.ref` to the focusable element, so focus-on-error works.

### File uploads
| Concern | Practice |
|:--|:--|
| Validation | client: type and size for fast feedback; server: always re-check (type by content, size limits) |
| Large files | upload directly to object storage with a presigned URL; the API only issues the URL and records the result ([03-backend/12-integrations](../../../03-backend/12-integrations/README.md)) |
| Progress | `XMLHttpRequest` `upload.onprogress` (fetch has no upload progress in browsers) |
| Cancel | `xhr.abort()` |
| Accessibility | a real `<input type="file">` with a label; announce progress politely; progress bar with `<progress>` |
| Previews | `URL.createObjectURL(file)`, revoked when done |

## Example
`InvoiceForm.tsx` — line items with a field array.
```tsx
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const Item = z.object({
  description: z.string().trim().min(1, 'Describe the item'),
  qty: z.coerce.number().int().min(1, 'At least 1'),
  unitPriceCents: z.coerce.number().int().min(0),
});
const Invoice = z.object({ items: z.array(Item).min(1, 'Add at least one line') });
type InvoiceInput = z.input<typeof Invoice>;
type InvoiceData = z.output<typeof Invoice>;

const emptyItem = { description: '', qty: 1, unitPriceCents: 0 };

export function InvoiceForm({ onSubmit }: { onSubmit: (d: InvoiceData) => Promise<void> }) {
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<InvoiceInput, unknown, InvoiceData>({ resolver: zodResolver(Invoice), defaultValues: { items: [emptyItem] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset>
        <legend>Line items</legend>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_6rem_8rem_auto] gap-2">   {/* stable key */}
            <input {...register(`items.${index}.description`)} aria-label={`Description, line ${index + 1}`} />
            <input {...register(`items.${index}.qty`)} inputMode="numeric" aria-label={`Quantity, line ${index + 1}`} />
            <input {...register(`items.${index}.unitPriceCents`)} inputMode="numeric" aria-label={`Unit price in cents, line ${index + 1}`} />
            <button type="button" onClick={() => remove(index)} aria-label={`Remove line ${index + 1}`}>Remove</button>
            {errors.items?.[index]?.description?.message && (
              <p role="alert">{errors.items?.[index]?.description?.message}</p>
            )}
          </div>
        ))}
      </fieldset>
      {/* array-level errors (e.g. "Add at least one line") land on items.root or items itself */}
      {(errors.items?.root?.message ?? errors.items?.message) && (
        <p role="alert">{errors.items?.root?.message ?? errors.items?.message}</p>
      )}
      <button type="button" onClick={() => append(emptyItem)}>Add line</button>
      <Total control={control} />
      <button type="submit" disabled={isSubmitting}>Save invoice</button>
    </form>
  );
}

function Total({ control }: { control: Control<InvoiceInput> }) {
  const items = useWatch({ control, name: 'items' }); // only this component re-renders on changes
  const cents = items.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.unitPriceCents || 0), 0);
  return <p aria-live="polite">Total: {(cents / 100).toFixed(2)}</p>;
}
```
A controlled third-party input with `Controller`:
```tsx
import { Controller } from 'react-hook-form';
import { DatePicker } from '@/components/ui/DatePicker'; // your wrapped date picker

<Controller
  control={control}
  name="deliveryDate"
  render={({ field, fieldState }) => (
    <DatePicker
      ref={field.ref}                       // focus on error works
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      aria-invalid={fieldState.invalid || undefined}
      label="Delivery date"
    />
  )}
/>
```
`uploadWithProgress.ts` — presigned upload with progress and cancel.
```ts
export function uploadWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  const xhr = new XMLHttpRequest();
  const done = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
  });
  xhr.open('PUT', url);                     // presigned S3 URL from your API
  xhr.setRequestHeader('Content-Type', file.type);
  xhr.send(file);
  return { done, cancel: () => xhr.abort() };
}
```
```tsx
<label htmlFor="avatar">Profile photo (JPEG or PNG, max 5 MB)</label>
<input id="avatar" type="file" accept="image/jpeg,image/png" {...register('avatar')} />
{progress !== null && <progress value={progress} max={100} aria-label="Upload progress">{progress}%</progress>}
```

## Production patterns
- **`field.id` as the key** for field arrays; append full default objects.
- **`useWatch` in small components** for derived values (totals) to avoid re-rendering the whole form.
- **Wrap third-party inputs once** in your design system with `Controller`-friendly props (`value`, `onChange`, `onBlur`, `ref`).
- **Uploads go straight to object storage** with presigned URLs; the server validates the result.
- **Show progress and allow cancel** for anything over a few MB.

## Mistakes
Wrong: index keys in field arrays.
```tsx
{fields.map((f, i) => <Row key={i} index={i} />)}
```
Right: `key={f.id}`.

Wrong: registering a custom component that has no native input.
```tsx
<DatePicker {...register('deliveryDate')} /> // never reports value changes
```
Right: `Controller`.

Wrong: uploading files through your API server as multipart for large files. Memory, timeouts, and bandwidth costs grow with traffic.
Right: presigned direct uploads.

Wrong: trusting the `accept` attribute or file extension as validation. Right: validate type by content and size on the server.

## Check yourself
1. Why must field array rows use `field.id` as the key?
2. When do you need `Controller` instead of `register`?
3. Why use `XMLHttpRequest` for upload progress?

<details>
<summary>Answers</summary>

1. React Hook Form tracks rows by that stable ID; index keys make React reuse DOM inputs for different rows after removals or moves, showing values in the wrong place.
2. For components that don't expose a native input element with standard events and a ref: custom date pickers, selects, sliders, editors.
3. Browsers expose upload progress events on `xhr.upload`; `fetch` doesn't provide upload progress in browsers.
</details>

## Sources
- [React Hook Form — `useFieldArray`](https://react-hook-form.com/docs/usefieldarray)
- [React Hook Form — `Controller`](https://react-hook-form.com/docs/usecontroller/controller)
- [React Hook Form — `useWatch`](https://react-hook-form.com/docs/usewatch)
- [MDN — `XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload)
- [AWS — Uploading objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
