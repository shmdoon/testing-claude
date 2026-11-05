import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeletionActions } from "@/components/dashboard/privacy-forms";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PENDING_RETENTION_DAYS } from "@/lib/privacy/constants";

export const metadata = { title: "Data requests" };

const SOURCE: Record<string, string> = { student: "Student", admin: "Parent (via admin)", auto: "Automatic" };
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

export default async function DeletionsPage({ searchParams }: PageProps<"/admin/deletions">) {
  await requireArea("admin", "/admin/deletions");
  const view = (await searchParams).view === "done" ? "done" : "pending";
  const supabase = await createClient();
  let q = supabase
    .from("deletion_requests")
    .select("id, subject_id, source, note, status, created_at, completed_at, cancelled_at, outcome, profiles!deletion_requests_student_id_fkey(full_name, class_level)")
    .order("created_at", { ascending: false })
    .limit(200);
  q = view === "pending" ? q.eq("status", "pending") : q.neq("status", "pending");
  const { data: rows } = await q;
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Data requests" description="Account deletion requests (DPDP Act). Confirm with the parent on WhatsApp, then delete within 30 days." />
      <Card className="gap-2 text-sm">
        <p>
          Deleting removes progress, answers, project files, messages and contact details. Orders and invoices are kept (GST law); accounts with
          purchases are anonymised and their login disabled. Accounts still waiting for a parent&apos;s approval after {PENDING_RETENTION_DAYS} days
          are removed automatically by the daily clean-up.
        </p>
      </Card>
      <div className="flex gap-2">
        <Button asChild size="sm" variant={view === "pending" ? "secondary" : "outline"}>
          <Link href="/admin/deletions">Pending</Link>
        </Button>
        <Button asChild size="sm" variant={view === "done" ? "secondary" : "outline"}>
          <Link href="/admin/deletions?view=done">Done / cancelled</Link>
        </Button>
      </div>
      {!rows?.length ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">No {view === "pending" ? "pending" : "past"} requests.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const name = r.profiles?.full_name ?? "Deleted account";
            const mode = (r.outcome as { mode?: string } | null)?.mode;
            return (
              <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4" data-testid="deletion-row">
                <p className="flex flex-wrap items-center gap-2">
                  <strong>{name}</strong>
                  {r.profiles?.class_level && <span className="text-sm text-muted-foreground">Class {r.profiles.class_level}</span>}
                  <Badge variant={r.status === "pending" ? "warning" : r.status === "completed" ? "success" : "outline"}>{r.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {SOURCE[r.source]} · requested {fmt(r.created_at)}
                    {r.completed_at && ` · done ${fmt(r.completed_at)}${mode ? ` (${mode})` : ""}`}
                    {r.cancelled_at && ` · cancelled ${fmt(r.cancelled_at)}`}
                  </span>
                </p>
                {r.note && <p className="rounded-lg bg-muted p-2 text-sm">{r.note}</p>}
                {r.status === "pending" && (
                  <>
                    <p className="text-sm">
                      <Link href={`/admin/students/${r.subject_id}`} className="text-primary underline">
                        View student &amp; parent contact
                      </Link>
                    </p>
                    <DeletionActions requestId={r.id} label={name} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
