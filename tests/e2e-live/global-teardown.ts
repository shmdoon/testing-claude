import { createClient } from "@supabase/supabase-js";

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
      const { data: files } = await admin.storage.from("submissions").list(u.id);
      if (files?.length) await admin.storage.from("submissions").remove(files.map((f) => `${u.id}/${f.name}`));
      await admin.from("audit_log").delete().eq("actor_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
  }
}
