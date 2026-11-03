import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { listLeads, parseLeadFilters } from "@/lib/marketing/admin-queries";
import { toCsv } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.profile.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const f = parseLeadFilters(Object.fromEntries(request.nextUrl.searchParams));
  const leads = await listLeads(f, 20_000);
  await writeAudit({ actorId: user.id, action: "leads.exported", metadata: { rows: leads.length, ...f } });
  const csv = toCsv(
    ["created_at", "parent_email", "parent_name", "child_class", "marketing_consent", "consent_at", "status", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "click_id_type", "landing_path", "referrer_host", "interest"],
    leads.map((l) => [l.created_at, l.parent_email, l.parent_name, l.child_class, l.marketing_consent, l.consent_at, l.status, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_term, l.utm_content, l.click_id_type, l.landing_path, l.referrer_host, l.interest]),
  );
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
