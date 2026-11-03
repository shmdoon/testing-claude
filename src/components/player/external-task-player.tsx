"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Clipboard, ClipboardCheck, ExternalLink, Send, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { completeExternalFallback, logExternalEvent, submitExternal } from "@/lib/learn/actions";
import type { PlayerSubmission, PlayerTool } from "@/lib/learn/queries";
import { mediaUrl, videoEmbedUrl } from "@/content/blocks/media";
import type { BlockOf, SubmissionType } from "@/content/blocks/schema";
import { usePlayer } from "./context";
import { ErrorText, Feedback, Prompt } from "./ui";
import { t } from "@/i18n";

type Block = BlockOf<"external_task">;

export function ExternalTaskPlayer({ block }: { block: Block }) {
  const { external, responses } = usePlayer();
  const ext = external[block.id];
  const done = responses[block.id]?.completed;
  const fallback = block.fallback;

  // Decide which experience this student gets.
  let mode: "tool" | "with_parent" | "alt_tool" | "demo_video" | "unavailable" = "unavailable";
  if (ext?.eligible) mode = "tool";
  else if (fallback?.kind === "with_parent" && ext?.tool?.enabled) mode = "with_parent";
  else if (fallback?.kind === "alternative_tool" && ext?.fallbackToolEligible) mode = "alt_tool";
  else if (fallback?.kind === "demo_video") mode = "demo_video";

  const launchTool = mode === "alt_tool" ? ext?.fallbackTool : ext?.tool;

  return (
    <section className="space-y-5" aria-label={t("player.externalTask")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">{t("player.externalTask")}</Badge>
        <Badge variant="outline">~{block.estimated_minutes} min</Badge>
        {launchTool && <Badge variant="outline">{launchTool.name}</Badge>}
      </div>
      <Prompt>{block.goal}</Prompt>

      {mode !== "tool" && mode !== "alt_tool" && <FallbackNotice mode={mode} block={block} toolName={ext?.tool?.name} />}

      {(mode === "tool" || mode === "with_parent" || mode === "alt_tool") && launchTool && (
        <>
          <Steps block={block} />
          {block.starter_prompts.length > 0 && <StarterPrompts block={block} />}
          <LaunchAndSubmit block={block} tool={launchTool} submissions={ext?.submissions ?? []} withParent={mode === "with_parent"} />
        </>
      )}

      {(mode === "demo_video" || mode === "unavailable") && !done && <AcknowledgeFallback block={block} mode={mode} />}
      {(mode === "demo_video" || mode === "unavailable") && done && <Feedback tone="good">{t("player.blockDone")}</Feedback>}
    </section>
  );
}

function Steps({ block }: { block: Block }) {
  return (
    <ol className="space-y-3">
      {block.steps.map((s, i) => (
        <li key={s.id} className="flex gap-3 rounded-xl border-2 bg-background p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground">{i + 1}</span>
          <div className="space-y-2">
            <p>{s.text}</p>
            {s.screenshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(s.screenshot.src)} alt={s.screenshot.alt} loading="lazy" className="max-h-64 rounded-lg border" />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StarterPrompts({ block }: { block: Block }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }
  return (
    <div className="space-y-3">
      {block.starter_prompts.map((p) => (
        <div key={p.id} className="space-y-2 rounded-xl bg-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{p.label}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => copy(p.id, p.text)} aria-live="polite">
              {copied === p.id ? <ClipboardCheck aria-hidden /> : <Clipboard aria-hidden />}
              {copied === p.id ? t("player.copied") : t("player.copy")}
            </Button>
          </div>
          <p className="font-mono text-sm whitespace-pre-wrap select-all">{p.text}</p>
        </div>
      ))}
    </div>
  );
}

const storageKey = (lessonId: string, blockId: string) => `ext-launch:${lessonId}:${blockId}`;
const noSubscribe = () => () => {};
function readLaunch(key: string): number | null {
  try {
    const v = sessionStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null; // storage unavailable (private mode etc.)
  }
}

function LaunchAndSubmit({ block, tool, submissions, withParent }: { block: Block; tool: PlayerTool; submissions: PlayerSubmission[]; withParent: boolean }) {
  const { lessonId } = usePlayer();
  // A launch survives a reload of this tab (sessionStorage); null on the server.
  const stored = useSyncExternalStore(noSubscribe, () => readLaunch(storageKey(lessonId, block.id)), () => null);
  const [launchedLocal, setLaunchedAt] = useState<number | null>(null);
  const launchedAt = launchedLocal ?? stored;
  const [showSubmit, setShowSubmit] = useState(submissions.length > 0);
  const reported = useRef(false);

  // Coming back to this tab after launching → show the submit panel.
  useEffect(() => {
    if (!launchedAt) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setShowSubmit(true);
      if (!reported.current) {
        reported.current = true;
        void logExternalEvent(lessonId, block.id, "returned", (Date.now() - launchedAt) / 1000);
        try {
          sessionStorage.removeItem(storageKey(lessonId, block.id));
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [launchedAt, lessonId, block.id]);

  function onLaunch() {
    const now = Date.now();
    reported.current = false;
    setLaunchedAt(now);
    try {
      sessionStorage.setItem(storageKey(lessonId, block.id), String(now));
    } catch {
      /* ignore */
    }
    void logExternalEvent(lessonId, block.id, "started");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-semibold">{withParent ? t("player.launchWithParent", { tool: tool.name }) : t("player.launchHint", { tool: tool.name })}</p>
          {tool.requires_account && <p className="text-sm text-muted-foreground">{t("player.needsAccount")}</p>}
        </div>
        <Button asChild size="lg">
          <a href={tool.base_url} target="_blank" rel="noopener noreferrer" onClick={onLaunch}>
            <ExternalLink aria-hidden /> {t("player.launchTool")}
            <span className="sr-only"> ({t("player.newTab")})</span>
          </a>
        </Button>
      </div>
      {launchedAt && !showSubmit && <p className="text-sm text-muted-foreground" role="status">{t("player.workingElsewhere")}</p>}
      {!showSubmit && (
        <Button type="button" variant="outline" onClick={() => setShowSubmit(true)}>
          <Send aria-hidden /> {t("player.imBack")}
        </Button>
      )}
      {showSubmit && <SubmitPanel block={block} submissions={submissions} />}
    </div>
  );
}

const KIND_LABEL: Record<SubmissionType, string> = { url: "player.kindUrl", screenshot: "player.kindScreenshot", file: "player.kindFile", text: "player.kindText" };

function SubmitPanel({ block, submissions }: { block: Block; submissions: PlayerSubmission[] }) {
  const { lessonId, refresh } = usePlayer();
  const latest = submissions[0];
  const [kind, setKind] = useState<SubmissionType>(block.submission_types[0]!);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const canResubmit = !latest || latest.status === "needs_revision";

  return (
    <div className="space-y-4 rounded-2xl border-2 bg-card p-4" id={`${block.id}-submit`}>
      <h3 className="text-lg font-bold">{t("player.submitWork")}</h3>
      {latest && <SubmissionStatus sub={latest} />}
      {canResubmit && (
        <form
          className="space-y-4"
          // onSubmit (not a form action) so a rejected link stays in the box for fixing.
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              setError(undefined);
              setNote(undefined);
              fd.set("kind", kind);
              const res = await submitExternal(lessonId, block.id, fd);
              if (!res.ok) return setError(res.error);
              if (res.urlStatus === "unreachable") setNote(t("player.urlUnreachable"));
              refresh();
            });
          }}
        >
          {block.submission_types.length > 1 && (
            <div role="radiogroup" aria-label={t("player.howSubmit")} className="flex flex-wrap gap-2">
              {block.submission_types.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn("min-h-11 rounded-lg border-2 px-4 font-semibold", kind === k && "border-primary bg-secondary")}
                >
                  {t(KIND_LABEL[k] as never)}
                </button>
              ))}
            </div>
          )}
          {kind === "url" && (
            <label className="block space-y-2">
              <span className="font-medium">{t("player.pasteLink")}</span>
              <Input name="url" type="url" inputMode="url" placeholder="https://your-site.netlify.app" required autoCapitalize="off" />
            </label>
          )}
          {(kind === "screenshot" || kind === "file") && (
            <label className="block space-y-2">
              <span className="font-medium">{kind === "screenshot" ? t("player.chooseScreenshot") : t("player.chooseFile")}</span>
              <input
                type="file"
                name="file"
                required
                accept={kind === "screenshot" ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,application/pdf"}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-semibold"
              />
              <span className="block text-sm text-muted-foreground">{t("player.uploadPrivacy")}</span>
            </label>
          )}
          {kind === "text" && (
            <label className="block space-y-2">
              <span className="font-medium">{t("player.describeWork")}</span>
              <textarea name="text" required rows={4} maxLength={5000} className="w-full rounded-xl border-2 border-input bg-background p-3" />
            </label>
          )}
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="share_in_gallery" className="mt-1 size-5" />
            <span>
              {t("player.shareGallery")}
              <span className="block text-sm text-muted-foreground">{t("player.shareGalleryHelp")}</span>
            </span>
          </label>
          <Button type="submit" disabled={pending}>
            <Send aria-hidden /> {pending ? t("common.loading") : t("player.submit")}
          </Button>
          <ErrorText>{error}</ErrorText>
        </form>
      )}
      {note && <Feedback tone="info">{note}</Feedback>}
    </div>
  );
}

function SubmissionStatus({ sub }: { sub: PlayerSubmission }) {
  if (sub.status === "approved") {
    return (
      <Feedback tone="good">
        <p className="font-semibold">{t("player.approved")}</p>
        {sub.feedback && <p>{sub.feedback}</p>}
      </Feedback>
    );
  }
  if (sub.status === "needs_revision") {
    return (
      <Feedback tone="try">
        <p className="font-semibold">{t("player.needsRevision")}</p>
        {sub.feedback && <p>“{sub.feedback}”</p>}
      </Feedback>
    );
  }
  return (
    <Feedback tone="info">
      <p className="font-semibold">{t("player.awaitingReview")}</p>
      <p className="text-sm">
        {sub.kind === "url" && sub.url ? (
          <a href={sub.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            {sub.url}
          </a>
        ) : (
          t(KIND_LABEL[sub.kind] as never)
        )}
      </p>
    </Feedback>
  );
}

function FallbackNotice({ mode, block, toolName }: { mode: "with_parent" | "demo_video" | "unavailable"; block: Block; toolName?: string }) {
  const fb = block.fallback;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-teal/50 bg-teal/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <UserRoundCheck className="size-5" aria-hidden />
        {mode === "with_parent" ? t("player.fallbackParentTitle") : mode === "demo_video" ? t("player.fallbackVideoTitle") : t("player.fallbackNoneTitle", { tool: toolName ?? "" })}
      </p>
      {fb && "instructions" in fb && fb.instructions && <Markdown>{fb.instructions}</Markdown>}
      {mode === "demo_video" && fb?.kind === "demo_video" && (
        <div className="aspect-video overflow-hidden rounded-xl border-2 bg-black">
          <iframe src={videoEmbedUrl(fb.provider, fb.url)} title={fb.title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" className="size-full" />
        </div>
      )}
    </div>
  );
}

function AcknowledgeFallback({ block, mode }: { block: Block; mode: "demo_video" | "unavailable" }) {
  const { lessonId, onSaved } = usePlayer();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await completeExternalFallback(lessonId, block.id);
            if (res.ok) onSaved(block.id, res, { fallback: mode });
            else setError(res.error);
          })
        }
      >
        <Check aria-hidden /> {mode === "demo_video" ? t("player.watchedIt") : t("player.continueWithout")}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
