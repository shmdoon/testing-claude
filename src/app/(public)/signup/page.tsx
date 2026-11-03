import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/auth/auth-card";
import { t } from "@/i18n";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  const googleEnabled = process.env.AUTH_GOOGLE_ENABLED === "true";
  return (
    <AuthCard
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("common.signIn")}
          </Link>
        </>
      }
    >
      <SignupForm />
      {googleEnabled && <GoogleButton />}
    </AuthCard>
  );
}
