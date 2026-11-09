---
title: Forms & Validation cheatsheet
tech: React Hook Form 7, Zod 4, React 19.2
version: React Hook Form 7.6x, @hookform/resolvers 5, Zod 4.4, React 19.2
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
---
# Forms & Validation cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Fundamentals
| Item | What it is | Note |
|:--|:--|:--|
| ⭐ Controlled input | `value` + `onChange` in state | re-renders per keystroke |
| ⭐ Uncontrolled input | DOM holds value, read on submit | RHF, Actions |
| `FormData` | read form values | `Object.fromEntries(fd)` |
| ⭐ `noValidate` | hide native bubbles, keep attributes | custom messages |
| ⭐ `<form action={fn}>` | React 19 Actions | simple forms |
| `useActionState` | state + pending for Actions | |
| `useFormStatus` | pending inside the form | submit buttons |
| Native constraints | `required`, `minLength`, `pattern`, `type` | semantics + autofill |

## useForm options
| Option | What it does | Note |
|:--|:--|:--|
| ⭐ `resolver: zodResolver(schema)` | schema validation | `@hookform/resolvers/zod` |
| ⭐ `defaultValues` | initial values | needed for `reset`, dirty tracking |
| `values` | controlled external values | e.g. data from a query |
| ⭐ `mode` | when to validate | `onTouched` recommended |
| `reValidateMode` | after submit | default `onChange` |
| ⭐ `shouldFocusError` | focus first error | default true |
| `criteriaMode` | first or all errors per field | `'all'` |
| `disabled` | disable all fields | |
| `shouldUnregister` | drop values of unmounted fields | default false |
| `delayError` | delay error display (ms) | |

## useForm methods
| Method | What it does |
|:--|:--|
| ⭐ `register(name, opts?)` | connect an input |
| ⭐ `handleSubmit(onValid, onInvalid?)` | validate, then submit |
| ⭐ `setError(name, { type, message }, { shouldFocus })` | add errors (server) |
| `setError('root.serverError', …)` | form-level error |
| `clearErrors(name?)` | remove errors |
| ⭐ `reset(values?, opts?)` | reset values/state |
| `resetField(name)` | reset one field |
| `setValue(name, v, { shouldValidate, shouldDirty })` | set programmatically |
| `getValues(name?)` | read without subscribing |
| `watch(name?)` / subscription | subscribe (re-renders host) |
| ⭐ `trigger(names?)` | validate on demand |
| `setFocus(name)` | focus a field |
| `unregister(name)` | remove a field |
| `control` | pass to Controller, useFieldArray, useWatch |

## formState
| Field | Means |
|:--|:--|
| ⭐ `errors` | field errors (`errors.email?.message`) |
| ⭐ `isSubmitting` | submit handler running |
| `isSubmitSuccessful` | last submit succeeded |
| ⭐ `isDirty` / `dirtyFields` | changed from defaults |
| `touchedFields` | blurred fields |
| `isValid` | all valid (subscribe to use) |
| `isValidating` | async validation running |
| `submitCount` | number of submits |
| `isLoading` | async default values loading |

## Hooks and components
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `useFieldArray({ control, name })` | repeating groups | key by `field.id` |
| ⭐ `Controller` / `useController` | controlled third-party inputs | pass `field.ref` |
| ⭐ `useWatch({ control, name })` | isolated subscriptions | derived values |
| `useFormContext()` + `FormProvider` | access form in nested components | multi-step |
| `useFormState({ control })` | isolated formState | |

## useFieldArray
| Method | What it does |
|:--|:--|
| ⭐ `fields` | rows with stable `id` |
| ⭐ `append(obj)` / `prepend(obj)` / `insert(i, obj)` | add rows (full objects) |
| ⭐ `remove(i)` | delete row(s) |
| `move(a, b)` / `swap(a, b)` | reorder |
| `update(i, obj)` / `replace(arr)` | change rows |
| `` register(`items.${i}.qty`) `` | nested field path |
| `errors.items?.[i]?.qty` | row errors |
| `errors.items?.root` | array-level errors |

## Zod 4 for forms
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `z.object({...})` | object schema | strips unknown keys |
| ⭐ `z.string().trim().min(1, 'msg')` | required text | |
| ⭐ `z.email('msg')` / `z.url()` | formats | top-level in v4 |
| `z.coerce.number()` | input string → number | input ≠ output type |
| `z.enum([...], { error })` | choices | radios, selects |
| `z.literal(true, { error })` | must be checked | terms checkbox |
| ⭐ `.refine(fn, { path, message })` | cross-field rules | confirm password |
| `.superRefine((d, ctx) => …)` | multiple custom issues | |
| `.transform(fn)` | normalize | lowercase emails |
| `.optional()` / `.or(z.literal(''))` | optional text inputs | empty string handling |
| `z.array(Item).min(1)` | field arrays | |
| ⭐ `z.input<typeof S>` / `z.output<typeof S>` | form vs parsed types | `useForm<In, unknown, Out>` |
| ⭐ `safeParse` | validate without throwing | API side |
| ⭐ `z.flattenError(err).fieldErrors` | `{ field: string[] }` | 422 responses |
| `z.treeifyError(err)` | nested errors | |
| `.pick({...})` / `.omit({...})` / `.partial()` | derive schemas | steps, PATCH |

## Shared schema architecture
| Piece | Role |
|:--|:--|
| ⭐ `packages/schemas` | Zod schemas in a workspace package |
| ⭐ Web: `zodResolver(Schema)` | instant feedback |
| ⭐ API: `Schema.safeParse(req.body)` | security gate |
| ⭐ 422 contract | `{ status, title, errors: { field: [msg] } }` |
| Client mapper | `setError` per field, `root.serverError` otherwise |
| Business rules | server-only checks (uniqueness, stock) also return field errors |

## Accessibility in forms
| Need | How |
|:--|:--|
| ⭐ Label | `<label htmlFor>` visible |
| ⭐ Error | `aria-describedby` + `aria-invalid` |
| Hint | `aria-describedby` |
| ⭐ Focus first error | `shouldFocusError` (RHF) |
| Groups | `<fieldset>` + `<legend>` |
| Error summary | links to fields (long forms) |
| Autofill | `autocomplete`, correct `type`, `inputMode` |
| Step changes | focus the step heading |

## Submission UX
| Moment | Do |
|:--|:--|
| ⭐ Pending | disable submit, "Saving…" |
| ⭐ Failure | keep values, inline errors, focus |
| Success | confirm, reset or navigate |
| Duplicates | `Idempotency-Key` on important POSTs |
| Unsaved changes | `beforeunload` warning |
| Slow | progress + reassurance |

## Uploads
| Item | What it does | Note |
|:--|:--|:--|
| `<input type="file" accept>` | file picker | `accept` is a hint only |
| `multiple` / `capture` | multi-file / camera | |
| ⭐ Presigned URL upload | browser → S3 directly | API issues URL |
| ⭐ `xhr.upload.onprogress` | upload progress | fetch lacks it |
| `xhr.abort()` | cancel | |
| `URL.createObjectURL(file)` | preview | revoke after use |
| Server validation | size + type by content | always |
| `<progress value max>` | accessible progress bar | |

## Multi-step and drafts
| Item | What it does | Note |
|:--|:--|:--|
| ⭐ One `useForm` + `FormProvider` | shared state across steps | |
| ⭐ `trigger(stepFields)` | validate one step | |
| Step in URL | back/forward/refresh | `?step=2` |
| Review step | confirm before submit | irreversible actions |
| `watch` subscription + debounce | save drafts | |
| `reset(draft)` | restore | |
| Versioned draft key | `form-draft:v1` | shape changes |
| No sensitive data in drafts | passwords, cards, IDs | server drafts instead |

## Testing
| API | What it does | Note |
|:--|:--|:--|
| ⭐ `userEvent.setup()` | realistic interactions | |
| ⭐ `await user.type(el, 'x')` / `user.click(el)` | type / click | |
| `user.selectOptions` / `user.upload` | selects / files | |
| ⭐ `getByLabelText('Email')` | find fields | accessible queries |
| ⭐ `getByRole('button', { name })` | find buttons | |
| `findByText` | await async UI | |
| ⭐ `toHaveFocus()` / `toHaveAttribute('aria-invalid','true')` | a11y assertions | jest-dom |
| `toBeDisabled()` | pending state | |
| ⭐ MSW `server.use(http.post(...))` | per-test API responses | 422, 500 |
| `vi.waitFor` | wait for callbacks | |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Different rules front/back | confusing errors | shared schema |
| Client-only validation | API bypassed | `safeParse` on server |
| Server errors as toasts | wrong field unknown | `setError` |
| Index keys in field arrays | values in wrong rows | `field.id` |
| `register` on custom widgets | no value | `Controller` |
| `watch()` at form root | re-renders everything | `useWatch` in leaf |
| `z.coerce.boolean()` for checkboxes | "false" → true | booleans from checkboxes / `z.stringbool()` |
| Missing `defaultValues` | dirty/reset broken | always set |
| Resetting on failure | lost input | keep values |
| `fireEvent.change` in tests | unrealistic | `user.type` |
| Sensitive drafts in localStorage | data exposure | non-sensitive only |
| `accept` as validation | trivially bypassed | server checks |

## Sources
| Source | Link |
|:--|:--|
| React Hook Form docs | https://react-hook-form.com/docs |
| @hookform/resolvers | https://github.com/react-hook-form/resolvers |
| Zod 4 | https://zod.dev/ |
| Zod error formatting | https://zod.dev/error-formatting |
| react.dev forms | https://react.dev/reference/react-dom/components/form |
| Testing Library user-event | https://testing-library.com/docs/user-event/intro |
| W3C WAI forms | https://www.w3.org/WAI/tutorials/forms/ |
