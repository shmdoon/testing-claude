import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/security/rate-limit";
import { exportStudentData } from "@/lib/privacy/service";

/** "Download my data" — the signed-in student's own data as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.profile.role !== "student") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await rateLimit(`privacy:export:${user.id}`, 5, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const data = await exportStudentData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
