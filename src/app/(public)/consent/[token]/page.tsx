import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getConsentByToken } from "@/lib/consent/service";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Approve your child's account", robots: { index: false, follow: false } };

export default function ConsentPage({ params }: PageProps<"/consent/[token]">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Suspense fallback={<p className="min-h-svh">Loading…</p>}>
        <Consent params={params} />
      </Suspense>
    </div>
  );
}

async function Consent({ params }: { params: PageProps<"/consent/[token]">["params"] }) {
  const { token } = await params;
  const c = await getConsentByToken(token);
  if (!c || c.expired) {
    return (
      <Card>
        <h1 className="text-2xl font-bold">This link has expired</h1>
        <p>Approval links are valid for 7 days. Your child can send a new one from their account.</p>
      </Card>
    );
  }
  const first = c.childName.split(" ")[0]!;
  if (c.granted) {
    return (
      <Card>
        <h1 className="text-2xl font-bold">Already approved</h1>
        <p>{first}&apos;s account is active. Thank you!</p>
      </Card>
    );
  }
  return (
    <Card className="gap-5">
      <ShieldCheck className="size-10 text-teal" aria-hidden />
      <h1 className="text-3xl font-bold">Approve {first}&apos;s account</h1>
      <p>
        <strong>{c.childName}</strong>
        {c.classLevel ? ` (Class ${c.classLevel})` : ""} signed up for AI Learning Hub — short, hands-on AI lessons. Because {first} is under 18,
        we need a parent or guardian to approve the account before they can learn.
      </p>
      <div className="rounded-xl bg-muted p-4 text-sm">
        <p className="mb-1 font-semibold">What we keep</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{first}&apos;s name, class and email ({c.childEmail}) and your WhatsApp number</li>
          <li>Lesson progress, answers, learning time and any projects {first} submits</li>
          <li>No ads or third-party trackers; photos are stripped of location data</li>
        </ul>
        <p className="mt-2">
          Read the{" "}
          <Link href="/legal/privacy" className="font-semibold underline">
            privacy policy
          </Link>
          . You can ask us to delete {first}&apos;s data at any time.
        </p>
      </div>
      <ConsentForm token={token} childFirstName={first} />
    </Card>
  );
}
