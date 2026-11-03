import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { requireUser } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/roles";
import { t } from "@/i18n";

export const metadata = { title: "Finish setting up" };

export default function CompleteProfilePage() {
  return (
    <AuthCard title={t("auth.completeTitle")} subtitle={t("auth.completeSubtitle")}>
      <Suspense fallback={<p>{t("common.loading")}</p>}>
        <Gate />
      </Suspense>
    </AuthCard>
  );
}

async function Gate() {
  const user = await requireUser("/signup/complete");
  if (user.profile.account_status !== "pending_profile") redirect(homeForRole(user.profile.role));
  return <CompleteProfileForm />;
}
