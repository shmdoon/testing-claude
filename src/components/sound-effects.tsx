"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { muteStore, play, useMuted } from "@/lib/sound/sound";
import { t } from "@/i18n";

/**
 * One document-level listener gives every button, link and checkbox a soft
 * click sound, and page changes a short whoosh — no per-component wiring.
 */
export function SoundEffects() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("button, a[href], [role='button'], input[type='checkbox'], input[type='radio'], select, summary");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-silent")) return;
      const tag = el.tagName.toLowerCase();
      play(tag === "input" ? "tick" : "tap");
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    play("whoosh");
  }, [pathname]);
  return null;
}

export function SoundToggle() {
  const muted = useMuted();
  return (
    <Button
      variant="ghost"
      size="icon"
      data-silent
      aria-pressed={muted}
      aria-label={muted ? t("common.soundOn") : t("common.soundOff")}
      onClick={() => {
        muteStore.toggle();
        if (!muteStore.get()) play("tap");
      }}
    >
      {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
    </Button>
  );
}
