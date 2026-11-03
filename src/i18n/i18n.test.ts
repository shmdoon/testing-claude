import { describe, expect, it } from "vitest";
import { format, t } from "./index";

describe("i18n", () => {
  it("looks up nested keys", () => {
    expect(t("common.appName")).toBe("AI Learning Hub");
  });
  it("interpolates variables", () => {
    expect(t("learn.welcome", { name: "Asha" })).toBe("Hi Asha!");
    expect(format("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
