import { Suspense } from "react";
import { LegalPage } from "@/components/legal-page";
import { TERMS } from "@/content/legal";

export const metadata = { title: TERMS.title, description: TERMS.summary[0] };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-3xl px-4 py-12" aria-busy="true" />}>
      <LegalPage doc={TERMS} />
    </Suspense>
  );
}
