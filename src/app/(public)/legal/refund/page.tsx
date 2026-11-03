import { t } from "@/i18n";

export const metadata = { title: t("legal.refund") };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-bold">{t("legal.refund")}</h1>
      <p className="mt-4 rounded-2xl border-2 border-warning/60 bg-warning/15 p-4">{t("legal.placeholder")}</p>
    </article>
  );
}
