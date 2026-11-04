import { describe, expect, it } from "vitest";
import { bestStreak, computeBadges, streak } from "./badges";
import { fillDays, istDate } from "@/lib/reports/days";

describe("streaks", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-10-28"];
  it("counts back from today or yesterday", () => {
    expect(streak(days, "2026-11-03")).toBe(3);
    expect(streak(days, "2026-11-04")).toBe(3); // today not done yet
    expect(streak(days, "2026-11-05")).toBe(0);
    expect(streak([], "2026-11-05")).toBe(0);
  });
  it("finds the best run", () => {
    expect(bestStreak(days)).toBe(3);
    expect(bestStreak(["2026-12-31", "2027-01-01"])).toBe(2);
  });
});

describe("badges", () => {
  it("marks earned badges and progress", () => {
    const b = computeBadges({ lessonsCompleted: 2, coursesCompleted: 0, bestStreak: 3, perfectQuizzes: 1, projectsApproved: 0, totalMinutes: 25, reflections: 6 });
    const by = Object.fromEntries(b.map((x) => [x.id, x]));
    expect(by["first-lesson"]!.earned).toBe(true);
    expect(by["five-lessons"]).toMatchObject({ earned: false, progress: { value: 2, goal: 5 } });
    expect(by["streak-3"]!.earned).toBe(true);
    expect(by["hour"]).toMatchObject({ earned: false, progress: { value: 25, goal: 60 } });
  });
});

describe("days", () => {
  it("fills gaps", () => {
    expect(fillDays("2026-11-01", "2026-11-03", [{ date: "2026-11-02", s: 5 }], (r) => [r?.s ?? 0])).toEqual([
      { date: "2026-11-01", values: [0] },
      { date: "2026-11-02", values: [5] },
      { date: "2026-11-03", values: [0] },
    ]);
  });
  it("uses India time", () => expect(istDate(new Date("2026-11-03T20:00:00Z"))).toBe("2026-11-04"));
});
