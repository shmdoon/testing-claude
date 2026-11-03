import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/auth/auth-card";
import { t } from "@/i18n";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const googleEnabled = process.env.AUTH_GOOGLE_ENABLED === "true";
  return (
    <AuthCard
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("common.signUp")}
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
      {googleEnabled && (
        <>
          <Divider />
          <GoogleButton />
        </>
      )}
    </AuthCard>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      {t("auth.or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
