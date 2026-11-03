"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { enrollFree } from "@/lib/learn/actions";
import { t } from "@/i18n";

export function EnrollButton({ courseId }: { courseId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await enrollFree(courseId);
            if (r?.error) setError(r.error);
          })
        }
      >
        {pending ? t("common.loading") : t("learn.enrollFree")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
