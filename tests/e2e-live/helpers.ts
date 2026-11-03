import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../src/lib/supabase/database.types";

export const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RUN = Date.now().toString(36);

/** Creates a confirmed throwaway user with a role. No email is sent. */
export async function createUser(role: Database["public"]["Enums"]["app_role"], meta: Record<string, string> = {}) {
  const email = `e2e-${role}-${RUN}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${role}`, signup_role: role === "parent" ? "parent" : "student", ...meta },
  });
  if (error) throw error;
  if (role === "content_editor" || role === "admin") {
    const { error: e } = await admin.from("profiles").update({ role, account_status: "active" }).eq("id", data.user.id);
    if (e) throw e;
  }
  return { id: data.user.id, email };
}

/** Signs the browser in via the magic-link route (token from the admin API). */
export async function signIn(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
}

export async function deleteUser(id: string) {
  await admin.auth.admin.deleteUser(id);
}
