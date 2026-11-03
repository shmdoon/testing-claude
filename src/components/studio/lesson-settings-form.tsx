"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteLesson, updateLessonSettings, type ActionState } from "@/lib/content/studio-actions";
import { CheckboxField, FormMessage, Submit, TextField } from "./fields";
import { checkedDefault, fieldDefault } from "@/lib/forms";

export function LessonSettingsForm({
  courseId,
  lesson,
}: {
  courseId: string;
  lesson: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    estimated_minutes: number;
    require_activity_first: boolean;
    is_preview: boolean;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateLessonSettings.bind(null, lesson.id), {});
  const [pending, startTransition] = useTransition();
  const fe = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <TextField name="title" label="Title" defaultValue={fieldDefault(v, "title", lesson.title)} error={fe.title} />
      <TextField name="slug" label="Slug" defaultValue={fieldDefault(v, "slug", lesson.slug)} error={fe.slug} />
      <TextField name="summary" label="Summary" multiline rows={3} defaultValue={fieldDefault(v, "summary", lesson.summary)} error={fe.summary} />
      <TextField name="estimated_minutes" label="Estimated minutes" type="number" min={1} max={240} defaultValue={fieldDefault(v, "estimated_minutes", lesson.estimated_minutes)} error={fe.estimated_minutes} />
      <CheckboxField name="require_activity_first" label="Students must try the activity before the module" defaultChecked={checkedDefault(v, "require_activity_first", lesson.require_activity_first)} />
      <CheckboxField name="is_preview" label="Free preview (visible without enrolling)" defaultChecked={checkedDefault(v, "is_preview", lesson.is_preview)} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <Submit variant="secondary">Save settings</Submit>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete "${lesson.title}" and all its versions?`)) {
              startTransition(async () => {
                await deleteLesson(courseId, lesson.id);
              });
            }
          }}
        >
          <Trash2 aria-hidden /> Delete lesson
        </Button>
      </div>
    </form>
  );
}
