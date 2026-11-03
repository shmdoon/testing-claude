import { en, type Messages } from "./en";

export const LOCALES = ["en"] as const; // "hi" will be added here
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Messages> = { en };

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends string
  ? never
  : T extends readonly unknown[]
    ? never
    : { [K in keyof T]-?: T[K] extends string ? K & string : Join<K & string, Leaves<T[K]>> }[keyof T];

export type MessageKey = Leaves<Messages>;

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Interpolate `{name}` placeholders. Unknown placeholders are left as-is. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Typed translator: `t("auth.codeSent", { email })`. */
export function getT(locale: Locale = DEFAULT_LOCALE) {
  const messages = getMessages(locale);
  return function t(key: MessageKey, vars?: Record<string, string | number>): string {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
    if (typeof node !== "string") return key;
    return format(node, vars);
  };
}

export const t = getT();
export const messages = getMessages();
