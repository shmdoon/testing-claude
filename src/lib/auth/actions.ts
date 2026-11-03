"use server";

import { echoOnError, type FormValues } from "@/lib/forms";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ATTRIBUTION_COOKIE, decodeAttribution } from "@/lib/marketing/attribution";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env.server";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  completeProfileSchema,
  emailSchema,
  formToObject,
  otpSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { homeForRole, safeNextPath } from "./roles";

export type AuthFormState = {
  step: "email" | "code";
  values?: FormValues;
  email?: string;
  next?: string;
  /** i18n key under `auth.errors` */
  error?: string;
  fieldErrors?: Record<string, string>;
};

function callbackUrl(path: string, next?: string) {
  const url = new URL(path, getServerEnv().NEXT_PUBLIC_SITE_URL);
  if (next) url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

function mapAuthError(error: AuthError): string {
  if (error.status === 429 || error.code?.includes("rate_limit")) return "rateLimited";
  if (error.code === "otp_expired" || error.code === "invalid_credentials") return "invalidCode";
  if (error.code === "email_address_invalid") return "invalidEmail";
  return "generic";
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

async function limited(kind: string, email?: string) {
  const ip = await getClientIp();
  const ipOk = await rateLimit(`auth:${kind}:ip:${ip}`, 10, 300);
  const emailOk = email ? await rateLimit(`auth:${kind}:email:${email}`, 5, 300) : true;
  return !(ipOk && emailOk);
}

/** Step 1 of sign-in: email a 6-digit code + magic link to an existing account. */
export async function requestLoginCode(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = formToObject(form);
  const parsed = emailSchema.safeParse(raw);
  const next = raw.next || undefined;
  if (!parsed.success) return { step: "email", next, fieldErrors: { email: "invalidEmail" } };
  const { email } = parsed.data;
  if (await limited("otp", email)) return { step: "email", email, next, error: "rateLimited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl("/auth/callback", next) },
  });
  // Unknown emails are treated like known ones so the form can't be used to
  // discover which children have accounts (privacy for minors).
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    return { step: "email", email, next, error: mapAuthError(error) };
  }
  return { step: "code", email, next };
}

/** Signup: creates the auth user (profile via DB trigger) and emails a code. */
export async function requestSignupCode(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  return echoOnError<AuthFormState>(form, async () => {
    const parsed = signupSchema.safeParse(formToObject(form));
    if (!parsed.success) return { step: "email", fieldErrors: fieldErrors(parsed.error.issues) };
    const input = parsed.data;
    if (await limited("signup", input.email)) return { step: "email", email: input.email, error: "rateLimited" };

    const attr = decodeAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
    const acquisition = attr ? { utm_source: attr.utm_source, utm_medium: attr.utm_medium, utm_campaign: attr.utm_campaign } : undefined;
    const base =
      input.role === "student"
        ? {
            signup_role: "student",
            full_name: input.full_name,
            class_level: String(input.class_level),
            parent_email: input.parent_email,
          }
        : { signup_role: "parent", full_name: input.full_name };
    const data = acquisition ? { ...base, acquisition } : base;

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: input.email,
      options: { shouldCreateUser: true, data, emailRedirectTo: callbackUrl("/auth/callback") },
    });
    if (error) return { step: "email", email: input.email, error: mapAuthError(error) };
    return { step: "code", email: input.email };
  }, (r) => r.step === "code");
}

/** Step 2: verify the 6-digit code and route by role. */
export async function verifyCode(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = formToObject(form);
  const parsed = otpSchema.safeParse(raw);
  if (!parsed.success) {
    return { step: "code", email: raw.email, next: raw.next, fieldErrors: { token: "invalidCode" } };
  }
  const { email, token, next } = parsed.data;
  if (await limited("verify", email)) return { step: "code", email, next, error: "rateLimited" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", email, next, error: error ? mapAuthError(error) : "generic" };

  redirect(await postSignInPath(data.user.id, next));
}

/** Where to send a user right after they sign in. */
export async function postSignInPath(userId: string, next?: string | null): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return "/login?error=generic";
  if (profile.account_status === "pending_profile") return "/signup/complete";
  return safeNextPath(next, homeForRole(profile.role));
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  if (!getServerEnv().AUTH_GOOGLE_ENABLED) redirect("/login?error=googleDisabled");
  const next = formToObject(form).next;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl("/auth/callback", next) },
  });
  if (error || !data.url) redirect("/login?error=generic");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type CompleteProfileState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: FormValues };

/** Finish onboarding for accounts created without details (e.g. Google). */
export async function completeProfile(_prev: CompleteProfileState, form: FormData): Promise<CompleteProfileState> {
  return echoOnError<CompleteProfileState>(form, async () => {
    const parsed = completeProfileSchema.safeParse(formToObject(form));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
    const input = parsed.data;

    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) redirect("/login");

    const { error } =
      input.role === "student"
        ? await supabase.rpc("complete_student_profile", {
            p_full_name: input.full_name,
            p_class_level: input.class_level,
            p_parent_email: input.parent_email,
          })
        : await supabase.rpc("complete_parent_profile", { p_full_name: input.full_name });

    if (error) {
      if (error.code === "22023") return { fieldErrors: { parent_email: "sameAsParent" } };
      return { error: "generic" };
    }
    redirect(input.role === "student" ? "/learn" : "/parent");
  });
}
