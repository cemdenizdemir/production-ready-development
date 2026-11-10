---
title: Forms & Validation cheatsheet
tech: React Hook Form 7, Zod 4, Orval, React 19.2
version: React Hook Form 7.6x, @hookform/resolvers 5, Zod 4.4, Orval 8.x, React 19.2
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Forms & Validation cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Fundamentals
| Item | Meaning | Note |
|:--|:--|:--|
| uncontrolled | DOM holds value | `register`, fast |
| controlled | state holds value | `Controller` |
| ⭐ `<form action={fn}>` | React 19 FormData actions | simple forms |
| `noValidate` | disable browser messages | schema drives messages |
| native validation | works without JS | progressive enhancement |

## useForm
| API | Does | Note |
|:--|:--|:--|
| ⭐ `useForm({ resolver, mode, defaultValues })` | create form | |
| ⭐ `register("field")` | wire input | |
| ⭐ `handleSubmit(onValid, onInvalid?)` | validate + submit | return the promise |
| ⭐ `formState.errors` | errors | `.message` |
| `isSubmitting` / `isSubmitSuccessful` | submit state | |
| `isDirty` / `dirtyFields` / `touchedFields` | tracking | |
| `setError(name, { message })` | manual/server errors | `root.server` for form-level |
| `clearErrors` | clear | |
| `reset(values)` | load / clear | |
| `trigger(names)` | validate fields | wizard steps |
| `getValues` / `setValue` | read / write | |
| `useWatch` | reactive values | isolated re-render |
| `setFocus` | focus field | |
| `shouldFocusError` | focus first error | default true |

## Validation modes
| Mode | Validates | Note |
|:--|:--|:--|
| `onSubmit` | on submit | default |
| `onBlur` | on blur | |
| ⭐ `onTouched` | after first blur, then on change | good default |
| `onChange` | every change | noisy |
| `reValidateMode` | after submit | default `onChange` |

## Zod 4
| Item | Example | Note |
|:--|:--|:--|
| ⭐ `z.object({...})` | shape | |
| `z.string().trim().min(1, "msg")` | required text | |
| `z.email()` / `z.uuid()` / `z.url()` | formats | top-level in v4 |
| `z.coerce.number()` | from strings | |
| `z.enum([...])` | choices | |
| `z.array(x).min(1).max(10)` | lists | |
| `.optional()` / `.nullable()` | absent / null | |
| `.refine(fn, { message, path })` | cross-field | |
| `.extend({...})` | add/override fields | extend generated |
| `z.infer<typeof s>` | TS type | |
| `.safeParse` | parse without throw | |
| ⭐ `zodResolver(schema)` | RHF integration | `@hookform/resolvers/zod` |

## Generated schemas (Orval)
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `client: "zod"` output | Zod per operation | separate Orval target |
| `createAddressBody` | request body schema | name from operationId |
| response schemas | validate API responses | where it matters |
| ⭐ extend, don't fork | `.extend` for UX | |
| regenerate in same PR | contract changes | CI diff |
| DataAnnotations → OpenAPI | constraints travel | FluentValidation usually doesn't |

## Server errors (ASP.NET Core)
| Item | Meaning | Note |
|:--|:--|:--|
| ⭐ `ValidationProblemDetails` | 400 with `errors` | |
| `errors` keys | `PostalCode`, `Lines[1].Quantity` | PascalCase, indexes |
| ⭐ key → path | `lines.1.quantity` | camelCase + dots |
| unknown keys | form-level message | `root.server` |
| friendly messages | set in C# | `ErrorMessage`, `.WithMessage` |
| 409 + `code` | business rule | near submit |
| `traceId` | reference for support | |

## Rule sources
| Rule | Lives in | Frontend |
|:--|:--|:--|
| ⭐ shape/limits | C# DTO attributes | generated Zod |
| cross-field | FluentValidation / `IValidatableObject` | server errors (+ optional `.refine`) |
| business | domain | server errors |
| UX-only | frontend | `.extend` / `.refine` |
| authority | always the API | client = convenience |

## Field arrays
| API | Does | Note |
|:--|:--|:--|
| ⭐ `useFieldArray({ control, name })` | list fields | |
| ⭐ `field.id` key | stable rows | not index |
| `append` / `prepend` / `insert` | add | |
| `remove` / `move` / `swap` / `replace` | modify | |
| `register(\`items.${i}.x\`)` | item fields | |
| `errors.items?.root` | array-level error | min/max |

## Controlled inputs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `<Controller render={({ field, fieldState }) => …} />` | wrap custom input | |
| `useController` | hook form | |
| forward `ref`, `onBlur` | focus + touched | |
| prefer native inputs | less code | `type="date"` |

## Uploads
| Item | Does | Note |
|:--|:--|:--|
| ⭐ SAS direct upload | browser → Blob Storage | large files |
| `x-ms-blob-type: BlockBlob` | Put Blob header | |
| API chooses blob name | no overwrites/traversal | |
| "complete" call | API validates file | magic bytes, scan |
| `XMLHttpRequest.upload.onprogress` | progress | fetch has none |
| `<progress value max>` | accessible progress | |
| `accept` + size check | UX only | server validates |
| storage CORS | allow PUT from origin | |
| multipart via API | small files | Kestrel limits |

## Submission UX
| Item | Practice | Note |
|:--|:--|:--|
| ⭐ pending | disable + "Saving…" | |
| ⭐ double submit | disabled + `Idempotency-Key` | |
| success | message/reset/navigate | `role="status"` |
| failure | keep input, show errors | |
| unsaved changes | warn on leave | sparingly |
| autosave | debounce + "Saved at" | |

## Multi-step and drafts
| Item | Practice | Note |
|:--|:--|:--|
| one form across steps | simplest | |
| `trigger(stepFields)` | validate step | |
| URL per step | Back works | |
| ⭐ server draft | checkout state in API | cross-device |
| local draft | convenience | no payment data |
| `aria-current="step"` | step indicator | focus heading |

## Testing
| Tool | Use | Note |
|:--|:--|:--|
| ⭐ Testing Library | render + role queries | |
| ⭐ `user-event` | realistic typing/clicking | `userEvent.setup()` |
| ⭐ MSW | mock API responses | 400/409/500 cases |
| `onUnhandledRequest: "error"` | catch missing mocks | |
| Orval `mock: true` | generated handlers | override per test |
| schema unit tests | Zod edge cases | |
| Playwright | real flows | 13-testing-monitoring |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| hand-written schema drift | client ≠ server | generate from OpenAPI |
| ignoring `errors` on 400 | generic failure | map to fields |
| index keys in field arrays | wrong row errors | `field.id` |
| `register` on custom pickers | value missing | `Controller` |
| submit handler not returning promise | `isSubmitting` false | await |
| big files through API | limits, slow | SAS upload |
| validating on first keystroke | annoying | `onTouched` |
| asserting RHF state in tests | brittle | visible text, ARIA |
| client-only rules | bypassable | server rules |

## Sources
| Source | Link |
|:--|:--|
| React Hook Form | https://react-hook-form.com/docs |
| @hookform/resolvers | https://github.com/react-hook-form/resolvers |
| Zod | https://zod.dev/ |
| Orval Zod | https://orval.dev/docs/guides/zod |
| ASP.NET Core validation | https://learn.microsoft.com/aspnet/core/mvc/models/validation |
| Azure Put Blob | https://learn.microsoft.com/rest/api/storageservices/put-blob |
| Testing Library | https://testing-library.com/docs/ |
| MSW | https://mswjs.io/docs/ |
