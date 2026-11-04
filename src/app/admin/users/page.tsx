import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleSelect } from "@/components/dashboard/role-select";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireArea("admin", "/admin/users");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80);
  const role = Array.isArray(sp.role) ? sp.role[0] : sp.role;
  let query = (await createClient()).from("profiles").select("id, full_name, email, role, account_status, created_at").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`email.ilike.%${q.replace(/[%,()*]/g, "")}%,full_name.ilike.%${q.replace(/[%,()*]/g, "")}%`);
  if (role && ["student", "parent", "content_editor", "admin"].includes(role)) query = query.eq("role", role as "student");
  const { data: users } = await query;
  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Role changes are recorded in the audit log. You can't change your own role." />
      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className="h-11 min-w-60 flex-1 rounded-lg border-2 border-input bg-background px-3" />
        <select name="role" defaultValue={role ?? ""} aria-label="Filter by role" className="h-11 rounded-lg border-2 border-input bg-background px-3" key={role ?? ""}>
          <option value="">All roles</option>
          {["student", "parent", "content_editor", "admin"].map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {["Name", "Email", "Status", "Joined", "Role"].map((h) => (
                <th key={h} scope="col" className="p-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b last:border-0" data-testid="user-row">
                <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <Badge variant={u.account_status === "active" ? "success" : "warning"}>{u.account_status.replace("_", " ")}</Badge>
                </td>
                <td className="p-3">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                <td className="p-3">
                  <RoleSelect userId={u.id} role={u.role} self={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
