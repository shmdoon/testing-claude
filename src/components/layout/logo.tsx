import Link from "next/link";
import { Sparkles } from "lucide-react";
import { t } from "@/i18n";

export function Logo({ href = "/", collapse = false }: { href?: string; collapse?: boolean }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2 rounded-lg text-lg font-bold">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
        <Sparkles className="size-5" />
      </span>
      <span className={collapse ? "whitespace-nowrap max-sm:sr-only" : "whitespace-nowrap"}>{t("common.appName")}</span>
    </Link>
  );
}
