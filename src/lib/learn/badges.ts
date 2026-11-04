import { addDays } from "@/lib/reports/days";

/**
 * Learning streak = consecutive India-time days with active learning, ending
 * today (or yesterday — today isn't over yet).
 */
export function streak(activeDates: string[], today: string): number {
  const set = new Set(activeDates);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export type BadgeStats = {
  lessonsCompleted: number;
  coursesCompleted: number;
  bestStreak: number;
  perfectQuizzes: number;
  projectsApproved: number;
  totalMinutes: number;
  reflections: number;
};

export type Badge = { id: string; title: string; description: string; earned: boolean; progress?: { value: number; goal: number } };

const DEFS: { id: string; title: string; description: string; metric: keyof BadgeStats; goal: number }[] = [
  { id: "first-lesson", title: "First steps", description: "Complete your first lesson.", metric: "lessonsCompleted", goal: 1 },
  { id: "five-lessons", title: "On a roll", description: "Complete 5 lessons.", metric: "lessonsCompleted", goal: 5 },
  { id: "course-complete", title: "Course champion", description: "Finish every lesson in a course.", metric: "coursesCompleted", goal: 1 },
  { id: "streak-3", title: "3-day streak", description: "Learn on 3 days in a row.", metric: "bestStreak", goal: 3 },
  { id: "streak-7", title: "Week-long streak", description: "Learn on 7 days in a row.", metric: "bestStreak", goal: 7 },
  { id: "perfect-quiz", title: "Sharp mind", description: "Score 100% on a quick check.", metric: "perfectQuizzes", goal: 1 },
  { id: "maker", title: "Maker", description: "Get a project approved by your teacher.", metric: "projectsApproved", goal: 1 },
  { id: "thinker", title: "Deep thinker", description: "Answer 5 reflection questions.", metric: "reflections", goal: 5 },
  { id: "hour", title: "Time well spent", description: "Spend 60 minutes learning.", metric: "totalMinutes", goal: 60 },
];

export function computeBadges(s: BadgeStats): Badge[] {
  return DEFS.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    earned: s[d.metric] >= d.goal,
    progress: { value: Math.min(s[d.metric], d.goal), goal: d.goal },
  }));
}

/** Longest run of consecutive dates (for "best streak"). */
export function bestStreak(activeDates: string[]): number {
  const sorted = [...new Set(activeDates)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
