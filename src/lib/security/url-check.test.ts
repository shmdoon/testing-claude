import { describe, expect, it } from "vitest";
import { checkUrl, isPublicIp, validateSubmissionUrl } from "./url-check";

const NETLIFY = ["*.netlify.app"];
const publicDns = async () => ["75.2.60.5"];
const ok200 = (async () => new Response("hi", { status: 200 })) as typeof fetch;

describe("validateSubmissionUrl", () => {
  it.each([
    ["https://asha.netlify.app", true],
    ["https://asha.netlify.app/page?x=1", true],
    ["http://asha.netlify.app", false],
    ["https://netlify.app", false],
    ["https://asha.netlify.app.evil.com", false],
    ["https://user:pw@asha.netlify.app", false],
    ["https://asha.netlify.app:8443", false],
    ["https://127.0.0.1", false],
    ["https://[::1]", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
  ])("%s → %s", (url, ok) => expect(validateSubmissionUrl(url, NETLIFY).ok).toBe(ok));

  it("rejects everything when the tool has no allowlist", () => {
    expect(validateSubmissionUrl("https://asha.netlify.app", []).ok).toBe(false);
  });
});

describe("isPublicIp", () => {
  it.each([
    ["8.8.8.8", true],
    ["75.2.60.5", true],
    ["10.0.0.1", false],
    ["172.16.5.4", false],
    ["192.168.1.1", false],
    ["127.0.0.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fd00::1", false],
    ["fe80::1", false],
    ["::ffff:10.0.0.1", false],
    ["2606:4700::1111", true],
  ])("%s → %s", (ip, pub) => expect(isPublicIp(ip)).toBe(pub));
});

describe("checkUrl", () => {
  it("marks a reachable site live", async () => {
    const r = await checkUrl("https://asha.netlify.app", NETLIFY, { lookup: publicDns, fetchImpl: ok200 });
    expect(r).toMatchObject({ ok: true, check: { status: "live", httpStatus: 200 } });
  });

  it("rejects hosts resolving to private IPs (DNS rebinding to metadata)", async () => {
    const r = await checkUrl("https://evil.netlify.app", NETLIFY, { lookup: async () => ["169.254.169.254"], fetchImpl: ok200 });
    expect(r.ok).toBe(false);
  });

  it("does not follow redirects off the allowlist", async () => {
    let calls = 0;
    const redirect = (async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } });
    }) as typeof fetch;
    const r = await checkUrl("https://asha.netlify.app", NETLIFY, { lookup: publicDns, fetchImpl: redirect });
    expect(r).toMatchObject({ ok: true, check: { status: "unreachable", reason: "Redirects to another site" } });
    expect(calls).toBe(1);
  });

  it("follows allowed redirects and caps the hops", async () => {
    const loop = (async (u: string) => new Response(null, { status: 301, headers: { location: `${u}x` } })) as unknown as typeof fetch;
    const r = await checkUrl("https://asha.netlify.app/", NETLIFY, { lookup: publicDns, fetchImpl: loop });
    expect(r).toMatchObject({ ok: true, check: { status: "unreachable", reason: "Too many redirects" } });
  });

  it("treats network failures as unreachable, not rejected", async () => {
    const fail = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const r = await checkUrl("https://asha.netlify.app", NETLIFY, { lookup: async () => { throw new Error("no dns"); }, fetchImpl: fail });
    expect(r).toMatchObject({ ok: true, check: { status: "unreachable" } });
  });
});
