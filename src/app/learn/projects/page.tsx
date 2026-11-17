import Link from "next/link";
import { Bot, CheckCircle2, Gamepad2, Lock, Tag, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/auth/dal";
import { DIFFICULTY_LABEL, getProjectLadder, type Project } from "@/lib/learn/projects";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export const metadata = { title: "Projects" };

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("size-2 rounded-full", i <= n ? (n <= 2 ? "bg-success" : n === 3 ? "bg-warning" : "bg-coral") : "bg-muted")} />
      ))}
    </span>
  );
}

function ProjectRow({ p, nextUp }: { p: Project; nextUp: boolean }) {
  const href = `/learn/${p.courseSlug}/${p.lessonSlug}`;
  const done = p.status === "completed";
  const body = (
    <>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", done ? "bg-success/15 text-success" : p.open ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
        {done ? <CheckCircle2 className="size-6" aria-hidden /> : p.open ? <Bot className="size-6" aria-hidden /> : <Lock className="size-6" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{p.title}</span>
          {nextUp && <Badge variant="accent">{t("projects.nextUp")}</Badge>}
          {done && <Badge variant="success">{t("projects.done")}</Badge>}
          {p.status === "in_progress" && <Badge variant="outline">{t("projects.inProgress")}</Badge>}
        </span>
        {p.summary && <span className="block text-sm text-muted-foreground">{p.summary}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Dots n={p.difficulty} />
            {DIFFICULTY_LABEL[p.difficulty]} · {t("projects.level", { n: p.difficulty })}
          </span>
          <span className="inline-flex items-center gap-1">
            {p.mode === "label" ? <Tag className="size-3.5" aria-hidden /> : <Gamepad2 className="size-3.5" aria-hidden />}
            {t(`projects.mode_${p.mode}` as never)}
          </span>
          <span>{p.arenaName}</span>
          <span>{t("courses.minutes", { n: p.minutes })}</span>
          {p.bestSeconds !== null && (
            <span className="inline-flex items-center gap-1 text-success">
              <Timer className="size-3.5" aria-hidden /> {t("projects.best", { s: p.bestSeconds })}
            </span>
          )}
        </span>
      </span>
      <span className="sr-only">{p.open ? "" : t("projects.locked")}</span>
    </>
  );
  return (
    <li data-testid="project-row" data-difficulty={p.difficulty}>
      {p.open ? (
        <Link href={href} className="lift flex items-center gap-3 rounded-2xl border-2 bg-card p-3 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed bg-muted/40 p-3">{body}</div>
      )}
    </li>
  );
}

export default async function ProjectsPage() {
  const user = await requireArea("learn", "/learn/projects");
  const { projects, nextUp } = await getProjectLadder(user);
  const done = projects.filter((p) => p.status === "completed").length;
  const lockedCourses = [...new Set(projects.filter((p) => !p.open).map((p) => p.courseSlug))];
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("projects.title")} description={t("projects.description")} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <p className="flex-1 text-sm">
          <strong>{t("projects.progress", { done, total: projects.length })}</strong>
          {nextUp && (
            <>
              {" · "}
              {t("projects.nextIs", { title: nextUp.title })}
            </>
          )}
        </p>
        {nextUp && (
          <Button asChild>
            <Link href={`/learn/${nextUp.courseSlug}/${nextUp.lessonSlug}`}>{t("projects.start")}</Link>
          </Button>
        )}
      </div>
      {projects.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">{t("projects.none")}</p>
      ) : (
        <ol className="space-y-2" aria-label={t("projects.ladder")}>
          {projects.map((p) => (
            <ProjectRow key={p.lessonId} p={p} nextUp={p === nextUp} />
          ))}
        </ol>
      )}
      {lockedCourses.length > 0 && user.profile.account_status === "active" && (
        <p className="text-sm text-muted-foreground">
          {t("projects.unlockHint")}{" "}
          {lockedCourses.map((slug, i) => (
            <span key={slug}>
              {i > 0 && ", "}
              <Link href={`/learn/${slug}`} className="font-medium text-primary underline">
                {projects.find((p) => p.courseSlug === slug)?.courseTitle}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
