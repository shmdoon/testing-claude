import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ToolForm } from "@/components/admin/tool-form";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "External tools" };

export default async function ToolsPage() {
  await requireArea("admin");
  const supabase = await createClient();
  const { data: tools, error } = await supabase.from("external_tools").select("*").order("name");
  if (error) throw error;
  return (
    <div className="space-y-6">
      <PageHeader
        title="External tools"
        description="Sites students use in external tasks. They always open in a new tab. Disable a tool or raise its minimum age here and every lesson using it switches to its fallback."
      />
      <ul className="space-y-4">
        {tools.map((tool) => (
          <li key={tool.id}>
            <details className="group rounded-2xl border-2 bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-2 p-4">
                <span className="text-lg font-bold">{tool.name}</span>
                <Badge variant={tool.enabled ? "success" : "warning"}>{tool.enabled ? "enabled" : "disabled"}</Badge>
                <Badge variant="outline">{tool.min_age}+</Badge>
                {tool.requires_account && <Badge variant="outline">needs account</Badge>}
                <span className="flex-1 text-sm text-muted-foreground">{tool.base_url}</span>
                <code className="text-xs text-muted-foreground">{tool.id}</code>
              </summary>
              <div className="border-t p-4">
                <ToolForm tool={tool} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <Card>
        <CardTitle>Add a tool</CardTitle>
        <ToolForm />
      </Card>
    </div>
  );
}
