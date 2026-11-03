"use client";

import { useActionState, useState } from "react";
import { createCourse, updateCourse, type ActionState } from "@/lib/content/studio-actions";
import { paiseToRupees, slugify } from "@/lib/validation/content";
import { CheckboxField, FormMessage, Submit, TextField } from "./fields";
import { checkedDefault, fieldDefault } from "@/lib/forms";

export type CourseFormDefaults = {
  id?: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  outcomes: string[];
  course_type: "mini" | "big";
  class_levels: number[];
  subject: string;
  is_free: boolean;
  price_paise: number;
};

const CLASS_OPTIONS = [6, 7, 8, 9, 10];

export function CourseForm({ course }: { course?: CourseFormDefaults }) {
  const action = course?.id ? updateCourse.bind(null, course.id) : createCourse;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [isFree, setIsFree] = useState(course?.is_free ?? false);
  const [slug, setSlug] = useState(course?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(course?.id));
  const fe = state.fieldErrors ?? {};
  const v = state.values;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="title"
          label="Title"
          defaultValue={fieldDefault(v, "title", course?.title)}
          error={fe.title}
          required
          onChange={(e) => !slugTouched && setSlug(slugify(e.currentTarget.value))}
        />
        <TextField
          name="slug"
          label="URL slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.currentTarget.value);
          }}
          error={fe.slug}
          help={`/courses/${slug || "…"}`}
          required
        />
      </div>
      <TextField name="subtitle" label="Subtitle" defaultValue={fieldDefault(v, "subtitle", course?.subtitle)} error={fe.subtitle} />
      <TextField name="description" label="Description" multiline defaultValue={fieldDefault(v, "description", course?.description)} error={fe.description} />
      <TextField
        name="outcomes"
        label="Learning outcomes"
        multiline
        rows={4}
        help="One per line."
        defaultValue={fieldDefault(v, "outcomes", course?.outcomes.join("\n"))}
        error={fe.outcomes}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="font-medium">Course size</legend>
          {(["mini", "big"] as const).map((opt) => (
            <label key={opt} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="course_type" value={opt} defaultChecked={fieldDefault(v, "course_type", course?.course_type ?? "mini") === opt} className="size-5" />
              {opt === "mini" ? "Mini (1–5 lessons)" : "Big (multi-week, modules)"}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium">Class levels</legend>
          <div className="flex flex-wrap gap-x-4">
            {CLASS_OPTIONS.map((n) => (
              <CheckboxField
                key={n}
                name="class_levels"
                value={String(n)}
                label={`Class ${n}`}
                defaultChecked={checkedDefault(v, "class_levels", (course?.class_levels ?? [7, 8]).includes(n), String(n))}
              />
            ))}
          </div>
          {fe.class_levels && <p className="text-sm font-medium text-destructive">{fe.class_levels}</p>}
        </fieldset>
      </div>

      <div className="grid gap-5 sm:grid-cols-3 sm:items-end">
        <TextField name="subject" label="Topic" defaultValue={fieldDefault(v, "subject", course?.subject ?? "ai")} error={fe.subject} help="e.g. ai, data, robotics" />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="is_free" checked={isFree} onChange={(e) => setIsFree(e.currentTarget.checked)} className="size-5" />
          Free course
        </label>
        <TextField
          name="price"
          label="Price (₹)"
          inputMode="decimal"
          disabled={isFree}
          defaultValue={fieldDefault(v, "price", course && !course.is_free ? paiseToRupees(course.price_paise) : "")}
          error={fe.price}
          help="Stored in paise. GST handling is configured in Settings."
        />
      </div>

      <FormMessage state={state} />
      <div>
        <Submit>{course?.id ? "Save course" : "Create course"}</Submit>
      </div>
    </form>
  );
}
