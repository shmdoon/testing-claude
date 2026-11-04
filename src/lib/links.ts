import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { hmacSha256Hex, safeEqualHex } from "@/lib/payments/signature";

/** Random URL-safe token (256 bits). Store only its SHA-256 hash. */
export function newToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("base64url");
}

export async function hashToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(d).toString("hex");
}

export function siteUrl(path: string): string {
  return new URL(path, getServerEnv().NEXT_PUBLIC_SITE_URL).toString();
}

function linkSecret(): string {
  const env = getServerEnv();
  // A dedicated secret is preferred; fall back to one derived from the service key so dev works.
  return env.LINK_SECRET || `derived:${env.SUPABASE_SECRET_KEY}`;
}

/** Signed, expiring link payload: `<id>.<exp>.<sig>` (e.g. invoice downloads sent on WhatsApp). */
export async function signLink(kind: string, id: string, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmacSha256Hex(linkSecret(), `${kind}:${id}:${exp}`);
  return `${id}.${exp}.${sig}`;
}

export async function verifyLink(kind: string, token: string): Promise<string | null> {
  const m = /^([0-9a-f-]{36})\.(\d{9,11})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return null;
  const [, id, exp, sig] = m;
  if (Number(exp) < Date.now() / 1000) return null;
  const expected = await hmacSha256Hex(linkSecret(), `${kind}:${id}:${exp}`);
  return safeEqualHex(expected, sig!) ? id! : null;
}
