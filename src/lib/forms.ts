/**
 * React 19 resets a <form action={…}> after every submission. To keep what the
 * user typed when validation fails, form actions return the submitted values
 * and the form uses them as defaults. Files and passwords are never echoed.
 */
export type FormValues = Record<string, string>;

export function echoForm(form: FormData): FormValues {
  const out: FormValues = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION") || /password|token/i.test(key)) continue;
    const vals = form.getAll(key).filter((v): v is string => typeof v === "string");
    if (vals.length) out[key] = vals.join(",");
  }
  return out;
}

export async function echoOnError<S extends { values?: FormValues }>(
  form: FormData,
  run: () => Promise<S>,
  succeeded: (result: S) => boolean = (r) => Boolean((r as { ok?: boolean }).ok),
): Promise<S> {
  const result = await run();
  return succeeded(result) ? result : { ...result, values: echoForm(form) };
}

/** Default for a text field: echoed value after a failed submit, else the saved value. */
export function fieldDefault(values: FormValues | undefined, key: string, saved?: string | number | null): string {
  if (values) return values[key] ?? "";
  return saved === null || saved === undefined ? "" : String(saved);
}

/** Default for a checkbox: unchecked boxes are absent from a submitted form. */
export function checkedDefault(values: FormValues | undefined, key: string, saved: boolean, value = "on"): boolean {
  if (values) return (values[key] ?? "").split(",").includes(value);
  return saved;
}
