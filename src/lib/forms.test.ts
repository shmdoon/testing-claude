import { describe, expect, it } from "vitest";
import { checkedDefault, echoForm, echoOnError, fieldDefault } from "./forms";

describe("form echo", () => {
  const fd = new FormData();
  fd.append("name", "Netlify");
  fd.append("class_levels", "7");
  fd.append("class_levels", "8");
  fd.append("token", "123456");
  fd.append("$ACTION_ID_abc", "");
  fd.append("cover", new File(["x"], "x.png"));

  it("echoes text fields, joins multi-values, drops secrets/files/internals", () => {
    expect(echoForm(fd)).toEqual({ name: "Netlify", class_levels: "7,8" });
  });

  it("only echoes on failure", async () => {
    expect((await echoOnError<{ ok?: boolean; values?: Record<string, string> }>(fd, async () => ({ ok: true }))).values).toBeUndefined();
    expect((await echoOnError<{ error?: string; values?: Record<string, string> }>(fd, async () => ({ error: "x" }))).values?.name).toBe("Netlify");
  });

  it("chooses defaults", () => {
    expect(fieldDefault(undefined, "name", "Saved")).toBe("Saved");
    expect(fieldDefault({ name: "Typed" }, "name", "Saved")).toBe("Typed");
    expect(fieldDefault({}, "name", "Saved")).toBe("");
    expect(checkedDefault(undefined, "enabled", true)).toBe(true);
    expect(checkedDefault({}, "enabled", true)).toBe(false);
    expect(checkedDefault({ class_levels: "7,8" }, "class_levels", false, "8")).toBe(true);
  });
});
