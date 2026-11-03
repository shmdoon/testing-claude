import { createClient } from "@supabase/supabase-js";
import { deleteUser } from "./helpers";

/** Safety net: remove any throwaway e2e users (and their data, via cascades) left by aborted runs. */
export default async function globalTeardown() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    for (const u of data.users) {
      if (!/^e2e-[a-z_]+-.+@example\.com$/.test(u.email ?? "")) continue;
      await deleteUser(u.id).catch((e) => console.error(e));
    }
    if (data.users.length < 200) break;
  }
  // Test-only gateway artefacts.
  await admin.from("webhook_events").delete().eq("provider", "mock");
  await admin.from("coupons").delete().like("code", "E2E%");
}
