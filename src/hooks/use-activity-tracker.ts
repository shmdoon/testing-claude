"use client";

import { useEffect, useRef } from "react";
import { ActivityMeter } from "@/lib/tracking/meter";
import { isVideoPlaying } from "@/lib/tracking/video-signal";

export const HEARTBEAT_URL = "/api/track/heartbeat";

export type TrackTarget = { courseId: string; lessonId?: string | null; blockId?: string | null };

const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;

/**
 * Active-time tracking (brief §6). Counts seconds while the tab is visible and
 * the student interacted in the last 60 s (or a video is playing); sends a
 * heartbeat every 30 s; flushes the remainder with sendBeacon on page hide.
 * The user is identified server-side from the session — never from the payload.
 */
export function useActivityTracker(target: TrackTarget | null) {
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  const enabled = Boolean(target?.courseId);

  useEffect(() => {
    if (!enabled) return;
    const meter = new ActivityMeter();
    const onInput = () => meter.input();
    for (const e of INPUT_EVENTS) window.addEventListener(e, onInput, { passive: true, capture: true });

    const payload = (seconds: number, flush: boolean) => {
      const t = targetRef.current!;
      return JSON.stringify({ course_id: t.courseId, lesson_id: t.lessonId ?? null, block_id: t.blockId ?? null, seconds, flush });
    };
    const send = (seconds: number) => {
      void fetch(HEARTBEAT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload(seconds, false),
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {});
    };
    const flush = () => {
      const s = meter.takeFlush();
      if (!s) return;
      const body = new Blob([payload(s, true)], { type: "application/json" });
      if (!navigator.sendBeacon?.(HEARTBEAT_URL, body)) {
        void fetch(HEARTBEAT_URL, { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => {});
      }
    };

    const timer = window.setInterval(() => {
      meter.tick(document.visibilityState === "visible", isVideoPlaying());
      const s = meter.takeBeat();
      if (s) send(s);
    }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      for (const e of INPUT_EVENTS) window.removeEventListener(e, onInput, { capture: true });
    };
  }, [enabled]);
}
