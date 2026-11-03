import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  allowedPhases,
  blockSchema,
  checkLessonForPublish,
  hostMatches,
  lessonBlocksSchema,
} from "./schema";

const TOOL = "00000000-0000-4000-8000-000000009003";

describe("block schemas", () => {
  it("knows all 16 block types", () => {
    expect(BLOCK_TYPES).toHaveLength(16);
    expect(BLOCK_TYPES).toContain("external_task");
  });

  it("rejects a block in the wrong phase", () => {
    const r = blockSchema.safeParse({ id: "q", type: "quiz", phase: "activity", questions: [] });
    expect(r.success).toBe(false);
    expect(allowedPhases("quiz")).toEqual(["check"]);
    expect(allowedPhases("rich_text")).toEqual(["activity", "reflection", "module"]);
  });

  it("validates fill_blank placeholders against blanks", () => {
    const base = { id: "f", type: "fill_blank", phase: "activity", blanks: [{ answers: ["a"] }, { answers: ["b"] }] };
    expect(blockSchema.safeParse({ ...base, text: "x {{0}} y {{1}}" }).success).toBe(true);
    expect(blockSchema.safeParse({ ...base, text: "x {{0}} y" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, text: "x {{0}} {{0}} {{1}}" }).success).toBe(false);
  });

  it("only allows approved simulation hosts over https", () => {
    const sim = (url: string) => blockSchema.safeParse({ id: "s", type: "embed_sim", phase: "activity", title: "T", url });
    expect(sim("https://phet.colorado.edu/sims/x").success).toBe(true);
    expect(sim("http://phet.colorado.edu/sims/x").success).toBe(false);
    expect(sim("https://evil.example.com").success).toBe(false);
    expect(sim("https://phet.colorado.edu.evil.com").success).toBe(false);
  });

  it("checks video URLs belong to the provider", () => {
    const v = (provider: string, url: string) =>
      blockSchema.safeParse({ id: "v", type: "video", phase: "module", title: "T", provider, url });
    expect(v("youtube", "https://www.youtube-nocookie.com/embed/abc").success).toBe(true);
    expect(v("youtube", "https://iframe.mediadelivery.net/embed/1/2").success).toBe(false);
    expect(v("bunny", "https://iframe.mediadelivery.net/embed/1/2").success).toBe(true);
    expect(v("cloudflare_stream", "https://customer-abc123.cloudflarestream.com/x/iframe").success).toBe(true);
  });

  it("requires mcq correct option to exist", () => {
    const quiz = (correct: string) =>
      blockSchema.safeParse({
        id: "q",
        type: "quiz",
        phase: "check",
        questions: [
          { kind: "mcq", id: "1", prompt: "P", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct_option_id: correct, explanation: "E" },
        ],
      });
    expect(quiz("a").success).toBe(true);
    expect(quiz("z").success).toBe(false);
  });

  it("validates external_task including fallback", () => {
    const task = {
      id: "t",
      type: "external_task",
      phase: "activity",
      tool_id: TOOL,
      goal: "Publish a page",
      steps: [{ id: "s1", text: "Do it", screenshot: { src: "course-media/steps/1.png", alt: "Step 1" } }],
      estimated_minutes: 20,
      submission_types: ["url"],
      fallback: { kind: "alternative_tool", tool_id: TOOL, instructions: "Use this instead" },
    };
    const r = blockSchema.safeParse(task);
    expect(r.success).toBe(true);
    expect(r.data && "starter_prompts" in r.data && r.data.starter_prompts).toEqual([]);
    expect(blockSchema.safeParse({ ...task, submission_types: [] }).success).toBe(false);
    expect(blockSchema.safeParse({ ...task, submission_types: ["url", "url"] }).success).toBe(false);
    expect(blockSchema.safeParse({ ...task, tool_id: "netlify" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...task, fallback: { kind: "demo_video", title: "T", provider: "youtube", url: "http://x" } }).success).toBe(false);
  });

  it("rejects javascript: image sources", () => {
    const img = (src: string) => blockSchema.safeParse({ id: "i", type: "image", phase: "module", src, alt: "A" });
    expect(img("javascript:alert(1)").success).toBe(false);
    expect(img("//evil.com/x.png").success).toBe(false);
    expect(img("/seed/x.svg").success).toBe(true);
    expect(img("https://example.com/x.png").success).toBe(true);
  });
});

describe("lesson validation", () => {
  const act = { id: "a", type: "checklist_task", phase: "activity", prompt: "P", steps: [{ id: "s", text: "S" }] };
  const mod = { id: "m", type: "rich_text", phase: "module", markdown: "M" };
  const refl = { id: "r", type: "reflection_prompt", phase: "reflection", prompt: "P" };

  it("enforces phase order and unique ids", () => {
    expect(lessonBlocksSchema.safeParse([act, refl, mod]).success).toBe(true);
    expect(lessonBlocksSchema.safeParse([mod, act]).success).toBe(false);
    expect(lessonBlocksSchema.safeParse([act, { ...mod, id: "a" }]).success).toBe(false);
  });

  it("requires activity + module to publish, warns about missing reflection/check", () => {
    const ok = checkLessonForPublish([act, mod]);
    expect(ok.ok).toBe(true);
    expect(ok.issues.map((i) => i.level)).toEqual(["warning", "warning"]);
    expect(checkLessonForPublish([mod]).ok).toBe(false);
    expect(checkLessonForPublish([act]).ok).toBe(false);
    expect(checkLessonForPublish("nope").ok).toBe(false);
  });
});

describe("hostMatches", () => {
  it.each([
    ["my-site.netlify.app", "*.netlify.app", true],
    ["netlify.app", "*.netlify.app", false],
    ["evilnetlify.app", "*.netlify.app", false],
    ["a.b.netlify.app", "*.netlify.app", true],
    ["customer-x1.cloudflarestream.com", "customer-*.cloudflarestream.com", true],
    ["customer-.cloudflarestream.com", "customer-*.cloudflarestream.com", false],
    ["PHET.colorado.edu", "phet.colorado.edu", true],
  ])("%s ~ %s = %s", (host, pattern, expected) => {
    expect(hostMatches(host, pattern)).toBe(expected);
  });
});
