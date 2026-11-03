"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addLesson,
  addModule,
  deleteModule,
  renameModule,
  reorderLessons,
  reorderModules,
  type ActionState,
} from "@/lib/content/studio-actions";
import { slugify } from "@/lib/validation/content";
import { FormMessage, Submit, TextField } from "./fields";
import { move } from "./reorder";

export type OutlineLesson = { id: string; slug: string; title: string; published_version_id: string | null; is_preview: boolean };
export type OutlineModule = { id: string; title: string; lessons: OutlineLesson[] };

/**
 * Modules and lessons with drag-to-reorder (mouse) and up/down buttons
 * (keyboard, touch, screen readers). Changes are optimistic and rolled back
 * if the server refuses them.
 */
export function CourseOutline({ courseId, initialModules }: { courseId: string; initialModules: OutlineModule[] }) {
  const [modules, setModules] = useState(initialModules);
  const [error, setError] = useState<string>();
  const [announce, setAnnounce] = useState("");
  const [saving, startTransition] = useTransition();
  const [savedOnce, setSavedOnce] = useState(false);
  const [drag, setDrag] = useState<{ kind: "module" | "lesson"; moduleId?: string; index: number } | null>(null);

  // Re-sync when the server sends new data (after add/delete).
  const [lastInitial, setLastInitial] = useState(initialModules);
  if (initialModules !== lastInitial) {
    setLastInitial(initialModules);
    setModules(initialModules);
  }

  function commit(next: OutlineModule[], save: () => Promise<ActionState>, label: string) {
    const prev = modules;
    setModules(next);
    setError(undefined);
    setAnnounce(label);
    startTransition(async () => {
      const res = await save();
      if (res.error) {
        setModules(prev);
        setError(res.error);
      } else setSavedOnce(true);
    });
  }

  function moveModule(from: number, to: number) {
    const next = move(modules, from, to);
    commit(next, () => reorderModules(courseId, next.map((m) => m.id)), `Moved module to position ${to + 1}`);
  }

  function moveLesson(mi: number, from: number, to: number) {
    const mod = modules[mi]!;
    const lessons = move(mod.lessons, from, to);
    const next = modules.map((m, i) => (i === mi ? { ...m, lessons } : m));
    commit(next, () => reorderLessons(mod.id, lessons.map((l) => l.id)), `Moved lesson to position ${to + 1}`);
  }

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {saving ? "Saving order…" : savedOnce ? "Order saved" : ""}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <ol className="space-y-4">
        {modules.map((m, mi) => (
          <li
            key={m.id}
            draggable
            onDragStart={(e) => {
              if ((e.target as HTMLElement).dataset.dragKind === "lesson") return;
              setDrag({ kind: "module", index: mi });
            }}
            onDragOver={(e) => drag?.kind === "module" && e.preventDefault()}
            onDrop={() => {
              if (drag?.kind === "module") moveModule(drag.index, mi);
              setDrag(null);
            }}
            className="rounded-2xl border-2 bg-card p-4"
            data-testid="module"
          >
            <ModuleHeader
              module={m}
              index={mi}
              count={modules.length}
              onMove={(to) => moveModule(mi, to)}
              onRenamed={(title) => setModules((ms) => ms.map((x) => (x.id === m.id ? { ...x, title } : x)))}
              onError={setError}
            />
            <ol className="mt-3 space-y-2">
              {m.lessons.map((l, li) => (
                <li
                  key={l.id}
                  draggable
                  data-drag-kind="lesson"
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDrag({ kind: "lesson", moduleId: m.id, index: li });
                  }}
                  onDragOver={(e) => drag?.kind === "lesson" && drag.moduleId === m.id && e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    if (drag?.kind === "lesson" && drag.moduleId === m.id) moveLesson(mi, drag.index, li);
                    setDrag(null);
                  }}
                  className="flex items-center gap-2 rounded-xl border bg-background p-2"
                >
                  <GripVertical className="size-5 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                  <Link
                    href={`/studio/courses/${courseId}/lessons/${l.id}`}
                    className="min-h-11 flex-1 content-center font-medium hover:underline"
                  >
                    {l.title}
                  </Link>
                  {l.is_preview && <Badge variant="accent">preview</Badge>}
                  <Badge variant={l.published_version_id ? "success" : "warning"}>
                    {l.published_version_id ? "published" : "draft"}
                  </Badge>
                  <MoveButtons label={l.title} index={li} count={m.lessons.length} onMove={(to) => moveLesson(mi, li, to)} />
                </li>
              ))}
            </ol>
            <AddLessonForm courseId={courseId} moduleId={m.id} />
          </li>
        ))}
      </ol>
      <AddModuleForm courseId={courseId} />
    </div>
  );
}

function MoveButtons({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (to: number) => void }) {
  return (
    <span className="flex shrink-0">
      <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move ${label} up`}>
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}

function ModuleHeader({
  module: m,
  index,
  count,
  onMove,
  onRenamed,
  onError,
}: {
  module: OutlineModule;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRenamed: (title: string) => void;
  onError: (e: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GripVertical className="size-5 cursor-grab text-muted-foreground" aria-hidden />
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          action={(fd) => {
            const title = String(fd.get("title") ?? "");
            startTransition(async () => {
              const res = await renameModule(m.id, title);
              if (res.error) onError(res.error);
              else {
                onRenamed(title.trim());
                setEditing(false);
              }
            });
          }}
        >
          <Input name="title" defaultValue={m.title} aria-label="Module title" autoFocus />
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      ) : (
        <h3 className="flex-1 text-lg font-bold">{m.title}</h3>
      )}
      {!editing && (
        <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={`Rename ${m.title}`}>
          <Pencil aria-hidden />
        </Button>
      )}
      <MoveButtons label={m.title} index={index} count={count} onMove={onMove} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete ${m.title}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteModule(m.id);
            if (res.error) onError(res.error);
          })
        }
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function AddLessonForm({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addLesson.bind(null, courseId), {});
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  if (!open) {
    return (
      <Button type="button" variant="ghost" className="mt-2" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add lesson
      </Button>
    );
  }
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-xl bg-muted/60 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="module_id" value={moduleId} />
      <TextField name="title" label="Lesson title" defaultValue={state.values?.title} error={state.fieldErrors?.title} onChange={(e) => setSlug(slugify(e.currentTarget.value))} autoFocus />
      <TextField name="slug" label="Slug" value={slug} onChange={(e) => setSlug(e.currentTarget.value)} error={state.fieldErrors?.slug} />
      <Submit>Create lesson</Submit>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addModule.bind(null, courseId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-dashed p-4" noValidate>
      <TextField name="title" label="New module title" defaultValue={state.ok ? "" : state.values?.title} error={state.fieldErrors?.title} className="flex-1" />
      <Submit variant="outline">Add module</Submit>
      <FormMessage state={{ error: state.error }} />
    </form>
  );
}
