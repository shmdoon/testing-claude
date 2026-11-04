import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getEngagement, parseEngagement } from "@/lib/reports/admin";
import { toCsv } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.profile.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const f = parseEngagement(Object.fromEntries(request.nextUrl.searchParams));
  const { rows } = await getEngagement(f);
  await writeAudit({ actorId: user.id, action: "engagement.exported", metadata: { rows: rows.length, ...f } });
  const csv = toCsv(
    ["group", "id", "name", "detail", "students", "active_minutes", "estimated_external_minutes", "lessons_completed", "from", "to"],
    rows.map((r) => [f.group, r.key_id, r.label, r.detail, r.students, (Number(r.active_seconds) / 60).toFixed(1), (Number(r.external_seconds) / 60).toFixed(1), r.lessons_completed, f.from, f.to]),
  );
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="engagement-${f.group}-${f.from}-to-${f.to}.csv"`, "cache-control": "no-store" },
  });
}
