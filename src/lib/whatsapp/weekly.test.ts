import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("./send", () => ({ sendWhatsApp: vi.fn() }));
import { weeklyHighlight } from "./weekly";

describe("weekly summary highlight", () => {
  it("adapts to the week", () => {
    expect(weeklyHighlight(2, 40)).toMatch(/Great progress/);
    expect(weeklyHighlight(0, 15)).toMatch(/Finishing one lesson/);
    expect(weeklyHighlight(0, 0)).toMatch(/restart/);
  });
});
