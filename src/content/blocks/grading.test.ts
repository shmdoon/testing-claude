import { describe, expect, it } from "vitest";
import { gradeBlock, sanitizeBlocksForStudent, seededShuffle } from "./grading";
import { blockSchema, type Block } from "./schema";

const b = (x: unknown) => blockSchema.parse(x) as Block;
const drag = b({ id: "d", type: "drag_sort", phase: "activity", prompt: "P", items: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] });
const quiz = b({
  id: "q",
  type: "quiz",
  phase: "check",
  passing_score: 60,
  questions: [
    { kind: "mcq", id: "1", prompt: "P", options: [{ id: "x", text: "X" }, { id: "y", text: "Y" }], correct_option_id: "y", explanation: "E1" },
    { kind: "true_false", id: "2", statement: "S", answer: false, explanation: "E2" },
    { kind: "short_answer", id: "3", prompt: "P", accepted_answers: ["Training Data"], explanation: "E3" },
  ],
});

describe("grading", () => {
  it("drag_sort scores positions and rejects tampered orders", () => {
    expect(gradeBlock(drag, { order: ["a", "b", "c"] })).toMatchObject({ ok: true, result: { score: 100, completed: true } });
    expect(gradeBlock(drag, { order: ["b", "a", "c"] })).toMatchObject({ ok: true, result: { score: 33 } });
    expect(gradeBlock(drag, { order: ["a", "a", "c"] }).ok).toBe(false);
    expect(gradeBlock(drag, { order: ["a", "b"] }).ok).toBe(false);
    expect(gradeBlock(drag, { score: 100 }).ok).toBe(false);
  });

  it("quiz is graded on the server with normalised short answers", () => {
    const r = gradeBlock(quiz, { answers: { "1": "y", "2": false, "3": "  training   data " } });
    expect(r).toMatchObject({ ok: true, result: { score: 100, completed: true, quiz: { passed: true } } });
    const f = gradeBlock(quiz, { answers: { "1": "x", "2": true } });
    expect(f).toMatchObject({ ok: true, result: { score: 0, completed: false, quiz: { passed: false } } });
    if (f.ok) expect(f.result.quiz?.results[0]).toMatchObject({ correct: false, correctAnswer: "Y", explanation: "E1" });
  });

  it("fill_blank accepts alternatives, case-insensitively by default", () => {
    const fb = b({ id: "f", type: "fill_blank", phase: "activity", text: "{{0}} and {{1}}", blanks: [{ answers: ["model"] }, { answers: ["data", "examples"] }] });
    expect(gradeBlock(fb, { answers: ["Model", "EXAMPLES"] })).toMatchObject({ ok: true, result: { score: 100 } });
    expect(gradeBlock(fb, { answers: ["", ""] })).toMatchObject({ ok: true, result: { completed: false } });
  });

  it("checklist completes only when every step is ticked; unknown ids ignored", () => {
    const cl = b({ id: "c", type: "checklist_task", phase: "activity", prompt: "P", steps: [{ id: "1", text: "a" }, { id: "2", text: "b" }] });
    expect(gradeBlock(cl, { checked: ["1", "zzz"] })).toMatchObject({ ok: true, result: { score: 50, completed: false }, response: { checked: ["1"] } });
    expect(gradeBlock(cl, { checked: ["1", "2"] })).toMatchObject({ ok: true, result: { completed: true } });
  });

  it("reflection needs min_chars", () => {
    const rf = b({ id: "r", type: "reflection_prompt", phase: "reflection", prompt: "P", min_chars: 10 });
    expect(gradeBlock(rf, { text: "short" })).toMatchObject({ ok: true, result: { completed: false } });
    expect(gradeBlock(rf, { text: "long enough answer" })).toMatchObject({ ok: true, result: { completed: true } });
  });

  it("strips quiz answers before reaching the browser", () => {
    const json = JSON.stringify(sanitizeBlocksForStudent([quiz, drag]));
    for (const secret of ["correct_option_id", "accepted_answers", "Training Data", "explanation", '"answer"']) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain('"items"');
  });
});

describe("seededShuffle", () => {
  it("is deterministic and never returns the solved order", () => {
    const items = ["a", "b", "c", "d"];
    expect(seededShuffle(items, "u1:d")).toEqual(seededShuffle(items, "u1:d"));
    for (let i = 0; i < 50; i++) expect(seededShuffle(items, `seed${i}`)).not.toEqual(items);
    expect([...seededShuffle(items, "x")].sort()).toEqual(items);
  });
});
