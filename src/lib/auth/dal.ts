import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { canAccessArea, homeForRole, type Area } from "./roles";

export type Profile = Pick<
  Tables<"profiles">,
  "id" | "email" | "full_name" | "role" | "account_status" | "class_level" | "locale"
>;

export type CurrentUser = { id: string; email: string; profile: Profile };

/**
 * Data Access Layer: the single place that turns the request's session into
 * a user + role. The role ALWAYS comes from the `profiles` table, never from
 * the client or from user-editable JWT metadata. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  // getClaims() verifies the JWT signature (unlike getSession()).
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, account_status, class_level, locale")
    .eq("id", sub)
    .maybeSingle();
  if (!profile) return null;

  return { id: sub, email: profile.email, profile };
});

export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  if (user.profile.account_status === "suspended") redirect("/login?error=suspended");
  return user;
}

/** Gate a protected area. Wrong role → their own home, never a 500. */
export async function requireArea(area: Area, nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  const { role, account_status } = user.profile;
  if (!canAccessArea(role, area)) redirect(homeForRole(role));
  if (role === "student" && account_status === "pending_profile") redirect("/signup/complete");
  return user;
}
