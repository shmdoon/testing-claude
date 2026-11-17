"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/sound/sound";

const COLORS = ["#2a78d6", "#eb6834", "#f2b541", "#2fa37a", "#8b5cf6"];

/** A short burst of confetti each time `burst` changes (0 = nothing). Skipped under reduced motion. */
export function Confetti({ burst }: { burst: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!burst || prefersReducedMotion()) return;
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    g.scale(dpr, dpr);
    const w = window.innerWidth;
    const parts = Array.from({ length: 90 }, (_, i) => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 4,
      r: 4 + Math.random() * 4,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
      c: COLORS[i % COLORS.length]!,
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      g.clearRect(0, 0, w, window.innerHeight);
      for (const p of parts) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        g.globalAlpha = Math.max(0, 1 - t / 1.8);
        g.fillStyle = p.c;
        g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        g.restore();
      }
      if (t < 1.8) raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, w, window.innerHeight);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [burst]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50" style={{ width: "100vw", height: "100vh" }} />;
}
