"use client";

import { useActivityTracker } from "@/hooks/use-activity-tracker";

/** Counts active time on a course home page (no lesson). Renders nothing. */
export function TrackCourse({ courseId }: { courseId: string }) {
  useActivityTracker({ courseId });
  return null;
}
