"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadWork } from "@/lib/learn/actions";
import type { BlockOf } from "@/content/blocks/schema";
import { usePlayer } from "./context";
import { ErrorText, Feedback, Prompt } from "./ui";
import { t } from "@/i18n";

export function UploadWorkPlayer({ block }: { block: BlockOf<"upload_work"> }) {
  const { lessonId, responses, onSaved } = usePlayer();
  const saved = responses[block.id]?.response as { files?: { name: string }[] } | undefined;
  const [files, setFiles] = useState(saved?.files ?? []);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const accept = [block.accept.includes("image") ? "image/png,image/jpeg,image/webp" : "", block.accept.includes("pdf") ? "application/pdf" : ""]
    .filter(Boolean)
    .join(",");
  return (
    <form
      className="space-y-4"
      // onSubmit (not a form action): the form is only reset after a successful upload.
      onSubmit={(e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const fd = new FormData(formEl);
        start(async () => {
          setError(undefined);
          const res = await uploadWork(lessonId, block.id, fd);
          if (!res.ok) return setError(res.error);
          const names = (fd.getAll("files") as File[]).map((f) => ({ name: f.name }));
          setFiles(names);
          formEl.reset();
          onSaved(block.id, res, { files: names });
        });
      }}
    >
      <Prompt>{block.prompt}</Prompt>
      <label className="block space-y-2">
        <span className="font-medium">{t("player.chooseFiles", { n: block.max_files })}</span>
        <input
          type="file"
          name="files"
          accept={accept}
          multiple={block.max_files > 1}
          required
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-semibold"
        />
      </label>
      <p className="text-sm text-muted-foreground">{t("player.uploadPrivacy")}</p>
      <Button type="submit" disabled={pending}>
        <Upload aria-hidden /> {pending ? t("common.loading") : t("player.upload")}
      </Button>
      <ErrorText>{error}</ErrorText>
      {files.length > 0 && <Feedback tone="good">{t("player.uploaded", { list: files.map((f) => f.name).join(", ") })}</Feedback>}
    </form>
  );
}
