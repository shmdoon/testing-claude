/**
 * SSRF-safe checks for URLs students submit (e.g. https://asha.netlify.app).
 * - https only, no credentials, default port only
 * - host must match the tool's allowlist (`external_tools.submission_domains`)
 * - every resolved IP must be public (no loopback/private/link-local/metadata)
 * - redirects followed manually (max 3), each hop re-checked
 * - short timeout, body never read
 * Liveness is informational for the reviewer; format/allowlist/IP failures reject.
 */
import { hostMatches } from "@/content/blocks/schema";

export type UrlCheck =
  | { status: "live"; httpStatus: number; finalUrl: string; checkedAt: string }
  | { status: "unreachable"; reason: string; checkedAt: string };

export type UrlRejection = { ok: false; reason: string };

export function validateSubmissionUrl(input: string, allowed: readonly string[]): { ok: true; url: URL } | UrlRejection {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "That doesn't look like a web address." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "The link must start with https://" };
  if (url.username || url.password) return { ok: false, reason: "Links can't contain a username or password." };
  if (url.port && url.port !== "443") return { ok: false, reason: "That link uses an unusual port." };
  if (isIpLiteral(url.hostname)) return { ok: false, reason: "Use the site's name, not an IP address." };
  if (allowed.length === 0 || !allowed.some((p) => hostMatches(url.hostname, p))) {
    return { ok: false, reason: `The link must be on ${allowed.join(" or ") || "an approved site"}.` };
  }
  return { ok: true, url };
}

function isIpLiteral(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":");
}

export function isPublicIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return false;
    if (v.startsWith("::ffff:")) return isPublicIp(v.slice(7));
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff")) return false; // ULA, link-local, multicast
    if (v.startsWith("64:ff9b:") || v.startsWith("2001:db8")) return false;
    return true;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

export type Lookup = (host: string) => Promise<string[]>;

/** Default resolver: Node's DNS when available (not on edge runtimes). */
export async function defaultLookup(host: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  const res = await dns.lookup(host, { all: true, verbatim: true });
  return res.map((r) => r.address);
}

export async function checkUrl(
  input: string,
  allowed: readonly string[],
  opts: { fetchImpl?: typeof fetch; lookup?: Lookup; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ ok: true; url: string; check: UrlCheck } | UrlRejection> {
  const first = validateSubmissionUrl(input, allowed);
  if (!first.ok) return first;
  const doFetch = opts.fetchImpl ?? fetch;
  const lookup = opts.lookup ?? defaultLookup;
  const checkedAt = new Date().toISOString();
  let current = first.url;

  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    let ips: string[] | null = null;
    try {
      ips = await lookup(current.hostname);
    } catch {
      ips = null; // DNS unavailable/failed: we can't verify — the allowlist still applies
    }
    if (ips && ips.some((ip) => !isPublicIp(ip))) return { ok: false, reason: "That site points to a private network address." };
    if (ips && ips.length === 0) return { ok: true, url: first.url.href, check: { status: "unreachable", reason: "Site not found", checkedAt } };

    let res: Response;
    try {
      res = await doFetch(current.href, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
        headers: { "user-agent": "AI-Learning-Hub-link-check/1.0", accept: "text/html" },
      });
      await res.body?.cancel().catch(() => {});
    } catch (e) {
      const reason = e instanceof Error && e.name === "TimeoutError" ? "Timed out" : "Couldn't connect";
      return { ok: true, url: first.url.href, check: { status: "unreachable", reason, checkedAt } };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = validateSubmissionUrl(new URL(res.headers.get("location")!, current).href, allowed);
      if (!next.ok) return { ok: true, url: first.url.href, check: { status: "unreachable", reason: "Redirects to another site", checkedAt } };
      current = next.url;
      continue;
    }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, url: first.url.href, check: { status: "live", httpStatus: res.status, finalUrl: current.href, checkedAt } };
    }
    return { ok: true, url: first.url.href, check: { status: "unreachable", reason: `Site answered ${res.status}`, checkedAt } };
  }
  return { ok: true, url: first.url.href, check: { status: "unreachable", reason: "Too many redirects", checkedAt } };
}
