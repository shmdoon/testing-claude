import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { CouponForm, CouponToggle } from "@/components/payments/coupon-form";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/format";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireArea("admin");
  const supabase = await createClient();
  const [{ data: coupons }, { data: courses }] = await Promise.all([
    supabase.from("coupons").select("*, courses(title)").order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").eq("is_free", false).order("title"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" description="Discounts are applied on the server when the order is created. One use per buyer per coupon." />
      <Card>
        <CardTitle>New coupon</CardTitle>
        <CouponForm courses={courses ?? []} />
      </Card>
      <ul className="space-y-3">
        {(coupons ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <code className="text-lg font-bold">{c.code}</code>
            <Badge variant={c.active ? "success" : "outline"}>{c.active ? "active" : "inactive"}</Badge>
            <span className="flex-1 text-sm text-muted-foreground">
              {c.kind === "percent" ? `${c.value}% off` : `${formatInr(c.value)} off`} · {c.courses?.title ?? "any course"} · used {c.used_count}
              {c.usage_limit ? `/${c.usage_limit}` : ""} {c.expires_at ? `· until ${new Date(c.expires_at).toLocaleDateString("en-IN")}` : ""}
            </span>
            <CouponToggle id={c.id} active={c.active} />
          </li>
        ))}
      </ul>
    </div>
  );
}
