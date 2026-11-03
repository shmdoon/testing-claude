import { describe, expect, it } from "vitest";
import { heartbeatSchema, isSameOrigin } from "./heartbeat";

const base = { course_id: "00000000-0000-4000-8000-000000000001", lesson_id: null, block_id: null, seconds: 30 };

describe("heartbeat payload", () => {
  it("accepts a valid beat, defaults flush", () => expect(heartbeatSchema.parse(base).flush).toBe(false));
  it.each([
    [{ seconds: 31 }],
    [{ seconds: 0 }],
    [{ seconds: 2.5 }],
    [{ course_id: "x" }],
    [{ block_id: "<script>" }],
  ])("rejects %j", (patch) => expect(heartbeatSchema.safeParse({ ...base, ...patch }).success).toBe(false));
  it("ignores a user id in the payload", () => {
    const r = heartbeatSchema.parse({ ...base, user_id: "someone-else" });
    expect(r).not.toHaveProperty("user_id");
  });
});

describe("isSameOrigin", () => {
  const site = "https://learn.example.com";
  it("allows the site origin and the request host", () => {
    expect(isSameOrigin("https://learn.example.com", null, "learn.example.com", site)).toBe(true);
    expect(isSameOrigin("http://localhost:3000", null, "localhost:3000", site)).toBe(true);
    expect(isSameOrigin(null, "https://learn.example.com/learn/x", null, site)).toBe(true);
  });
  it("rejects other sites and missing origins", () => {
    expect(isSameOrigin("https://evil.com", null, "learn.example.com", site)).toBe(false);
    expect(isSameOrigin(null, null, "learn.example.com", site)).toBe(false);
  });
});
