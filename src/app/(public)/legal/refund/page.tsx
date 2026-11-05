import { Suspense } from "react";
import { LegalPage } from "@/components/legal-page";
import { REFUND } from "@/content/legal";

export const metadata = { title: REFUND.title, description: "How refunds and cancellations work for AI Learning Hub courses." };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-3xl px-4 py-12" aria-busy="true" />}>
      <LegalPage doc={REFUND} />
    </Suspense>
  );
}
