import { describe, expect, it } from "vitest";
import { APP_ROLES, areaForPath, canAccessArea, homeForRole, safeNextPath, type Area, type AppRole } from "./roles";

describe("role → area access matrix", () => {
  const expected: Record<AppRole, Area[]> = {
    student: ["learn"],
    parent: ["parent"],
    content_editor: ["studio"],
    admin: ["learn", "parent", "studio", "admin"],
  };
  const areas: Area[] = ["learn", "parent", "studio", "admin"];

  for (const role of APP_ROLES) {
    for (const area of areas) {
      const allowed = expected[role].includes(area);
      it(`${role} ${allowed ? "can" : "cannot"} enter ${area}`, () => {
        expect(canAccessArea(role, area)).toBe(allowed);
      });
    }
    it(`${role}'s home is an area they can enter`, () => {
      const home = homeForRole(role);
      const area = areaForPath(home);
      expect(area).not.toBeNull();
      expect(canAccessArea(role, area!)).toBe(true);
    });
  }
});

describe("areaForPath", () => {
  it.each([
    ["/learn", "learn"],
    ["/learn/ai-basics/lesson-1", "learn"],
    ["/admin/payments", "admin"],
    ["/studio", "studio"],
    ["/parent", "parent"],
    ["/", null],
    ["/courses", null],
    ["/learning-tips", null],
    ["/administrator", null],
  ])("%s → %s", (path, area) => {
    expect(areaForPath(path)).toBe(area);
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/learn", "/learn"],
    ["/learn/x?y=1#z", "/learn/x?y=1#z"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [null, "/"],
    [undefined, "/"],
  ])("%s → %s", (input, out) => {
    expect(safeNextPath(input as string | null | undefined)).toBe(out);
  });
  it("uses the fallback", () => expect(safeNextPath("http://x", "/parent")).toBe("/parent"));
});
