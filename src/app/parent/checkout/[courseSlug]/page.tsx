import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/area-shell";
import { Card } from "@/components/ui/card";
import { CheckoutForm } from "@/components/payments/checkout-form";
import { requireArea } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/provider";
import { t } from "@/i18n";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: PageProps<"/parent/checkout/[courseSlug]">) {
  const { courseSlug } = await params;
  const user = await requireArea("parent", `/parent/checkout/${courseSlug}`);
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, title, is_free, price_paise").eq("slug", courseSlug).maybeSingle();
  if (!course || course.is_free) notFound();

  // Linked children (RLS lets parents read their linked children's profiles).
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("student_id, profiles!parent_student_links_student_id_fkey(full_name, account_status)")
    .eq("parent_id", user.id)
    .eq("status", "active");
  const ids = (links ?? []).map((l) => l.student_id);
  const { data: enrolled } = ids.length
    ? await createAdminClient().from("enrollments").select("user_id").eq("course_id", course.id).eq("status", "active").in("user_id", ids)
    : { data: [] };
  const children = (links ?? [])
    .filter((l) => l.profiles?.account_status === "active")
    .map((l) => ({ id: l.student_id, name: l.profiles?.full_name ?? "Student", enrolled: (enrolled ?? []).some((e) => e.user_id === l.student_id) }));
  const mode = paymentsMode();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={t("pay.title")} description={course.title} />
      <Card>
        {mode === "disabled" ? (
          <p>{t("pay.disabled")}</p>
        ) : (
          <>
            {mode === "mock" && <p className="rounded-lg bg-warning/20 p-2 text-sm font-semibold">{t("pay.mockNotice")}</p>}
            <CheckoutForm courseId={course.id} courseTitle={course.title} listPaise={course.price_paise} students={children} />
          </>
        )}
      </Card>
    </div>
  );
}
