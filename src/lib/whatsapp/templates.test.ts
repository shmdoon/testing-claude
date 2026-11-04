import { describe, expect, it } from "vitest";
import { renderText, TEMPLATES } from "./templates";

describe("WhatsApp templates", () => {
  it("every template renders all its params", () => {
    for (const [name, def] of Object.entries(TEMPLATES)) {
      const params = def.params.map((p) => `<${p}>`);
      const text = renderText(name as keyof typeof TEMPLATES, params);
      for (const p of params) expect(text, name).toContain(p);
    }
  });
});
