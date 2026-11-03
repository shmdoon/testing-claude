"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setCourseStatus, uploadCourseCover, type ActionState } from "@/lib/content/studio-actions";
import { FormMessage, Submit } from "./fields";

export function CourseStatusControls({ courseId, status }: { courseId: string; status: "draft" | "published" | "archived" }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const next = status === "published" ? "draft" : "published";
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={status === "published" ? "outline" : "default"}
        disabled={pending}
        onClick={() => startTransition(async () => setState(await setCourseStatus(courseId, next)))}
      >
        {status === "published" ? "Unpublish course" : "Publish course"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function CoverUpload({ courseId }: { courseId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(uploadCourseCover.bind(null, courseId), {});
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-2">
        <span className="font-medium">Cover image</span>
        <input
          type="file"
          name="cover"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-semibold"
        />
        <span className="block text-sm text-muted-foreground">PNG, JPEG or WebP, up to 2 MB. 16:9 works best.</span>
      </label>
      {state.fieldErrors?.cover && <p className="text-sm font-medium text-destructive">{state.fieldErrors.cover}</p>}
      <FormMessage state={state} />
      <Submit variant="secondary">Upload cover</Submit>
    </form>
  );
}
