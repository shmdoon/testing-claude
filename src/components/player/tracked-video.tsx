"use client";

import { useEffect, useId, useRef } from "react";
import { Markdown } from "@/components/markdown";
import { videoEmbedUrl } from "@/content/blocks/media";
import { setVideoPlaying } from "@/lib/tracking/video-signal";
import { t } from "@/i18n";

const YT_ORIGINS = new Set(["https://www.youtube.com", "https://www.youtube-nocookie.com"]);

/**
 * Lesson video that tells the activity tracker when it's playing (watching
 * counts as active time without mouse/keyboard input). YouTube reports state
 * via its iframe API postMessage protocol; other players fall back to the
 * "focus is inside the video" heuristic in video-signal.ts.
 */
export function TrackedVideo({
  provider,
  url,
  title,
  captionsUrl,
  transcript,
}: {
  provider: "youtube" | "bunny" | "cloudflare_stream";
  url: string;
  title: string;
  captionsUrl?: string;
  transcript?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLIFrameElement>(null);
  const isYouTube = provider === "youtube";
  // Same URL on server and client (no hydration mismatch); enablejsapi turns on state events.
  const src = (() => {
    const base = videoEmbedUrl(provider, url);
    if (!isYouTube) return base;
    const u = new URL(base);
    u.searchParams.set("enablejsapi", "1");
    return u.toString();
  })();

  useEffect(() => {
    if (!isYouTube) return;
    const onMessage = (e: MessageEvent) => {
      if (!YT_ORIGINS.has(e.origin) || e.source !== ref.current?.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const state = data?.event === "onStateChange" ? data.info : data?.info?.playerState;
        if (typeof state === "number") setVideoPlaying(id, state === 1 || state === 3);
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      setVideoPlaying(id, false);
    };
  }, [id, isYouTube]);

  const listen = () => {
    ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id, channel: "widget" }), "*");
  };

  return (
    <figure className="space-y-2">
      <div className="aspect-video overflow-hidden rounded-xl border-2 bg-black">
        <iframe
          ref={ref}
          src={src}
          title={title}
          data-video="true"
          loading="lazy"
          onLoad={listen}
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full"
        />
      </div>
      <figcaption className="text-sm text-muted-foreground">{title}</figcaption>
      {(captionsUrl || transcript) && (
        <details className="rounded-xl border p-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{t("player.transcript")}</summary>
          {captionsUrl && (
            <a href={captionsUrl} className="font-medium text-primary underline" target="_blank" rel="noopener noreferrer">
              {t("player.captionsFile")}
            </a>
          )}
          {transcript && <Markdown className="mt-2">{transcript}</Markdown>}
        </details>
      )}
    </figure>
  );
}
