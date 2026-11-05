import { Suspense } from "react";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/content/legal";

export const metadata = { title: PRIVACY.title, description: PRIVACY.summary[0] };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-3xl px-4 py-12" aria-busy="true" />}>
      <LegalPage doc={PRIVACY} />
    </Suspense>
  );
}
