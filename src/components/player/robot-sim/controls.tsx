"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { Action } from "@/lib/sim/physics";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const KEYS: Record<string, Action> = {
  ArrowUp: "forward",
  KeyW: "forward",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

/** Arrow keys / WASD drive the rover while `enabled`. Held keys combine: a turn beats forward. */
export function useKeyboardDrive(enabled: boolean, onInput: (a: Action | null) => void) {
  const held = useRef(new Set<Action>());
  useEffect(() => {
    if (!enabled) {
      held.current.clear();
      onInput(null);
      return;
    }
    const resolve = () => {
      const h = held.current;
      onInput(h.has("left") ? "left" : h.has("right") ? "right" : h.has("forward") ? "forward" : null);
    };
    const down = (e: KeyboardEvent) => {
      const a = KEYS[e.code];
      if (!a || e.repeat) {
        if (a) e.preventDefault();
        return;
      }
      e.preventDefault();
      held.current.add(a);
      resolve();
    };
    const up = (e: KeyboardEvent) => {
      const a = KEYS[e.code];
      if (!a) return;
      held.current.delete(a);
      resolve();
    };
    const blur = () => {
      held.current.clear();
      resolve();
    };
    const set = held.current;
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      set.clear();
    };
  }, [enabled, onInput]);
}

/** Touch / mouse D-pad. Press and hold. */
export function DPad({ onInput, active, disabled }: { onInput: (a: Action | null) => void; active: Action | null; disabled?: boolean }) {
  const btn = (a: Action, label: string, Icon: typeof ArrowUp, extra?: string) => (
    <button
      type="button"
      data-silent
      aria-label={label}
      aria-pressed={active === a}
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onInput(a);
      }}
      onPointerUp={() => onInput(null)}
      onPointerCancel={() => onInput(null)}
      onLostPointerCapture={() => onInput(null)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "grid size-16 touch-none place-items-center rounded-2xl border-2 bg-background text-foreground select-none transition-[background-color,transform] active:scale-95 disabled:opacity-50",
        active === a && "border-primary bg-secondary",
        extra,
      )}
    >
      <Icon className="size-7" aria-hidden />
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("sim.drive")}>
      <span />
      {btn("forward", t("sim.forward"), ArrowUp)}
      <span />
      {btn("left", t("sim.left"), ArrowLeft)}
      <span className="grid place-items-center text-xs text-muted-foreground">{t("sim.hold")}</span>
      {btn("right", t("sim.right"), ArrowRight)}
    </div>
  );
}
