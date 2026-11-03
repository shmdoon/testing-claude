import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Button } from "@/components/ui/button";
import { listLeads, parseLeadFilters, summarise } from "@/lib/marketing/admin-queries";
import { campaigns } from "@/content/marketing";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const f = parseLeadFilters(await searchParams);
  const leads = await listLeads(f);
  const summary = summarise(leads);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const input = "h-11 rounded-lg border-2 border-input bg-background px-3 block";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`Parents who asked for the free lesson. Campaign pages: ${Object.keys(campaigns).map((k) => `/lp/${k}`).join(", ")}`}
      />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Campaign (utm_campaign)</span>
          <input name="campaign" defaultValue={f.campaign} className={input} placeholder="any" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">From</span>
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">To</span>
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <Button type="submit">Filter</Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/leads-csv${qs ? `?${qs}` : ""}`}>
            <Download aria-hidden /> CSV
          </a>
        </Button>
      </form>

      <section aria-labelledby="by-campaign">
        <h2 id="by-campaign" className="mb-2 text-xl font-bold">
          By campaign
        </h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Campaign", "Source", "Medium", "Leads", "Opted in to updates"].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={`${r.campaign}${r.source}${r.medium}`} className="border-b last:border-0">
                  <td className="p-3 font-medium">{r.campaign}</td>
                  <td className="p-3">{r.source}</td>
                  <td className="p-3">{r.medium}</td>
                  <td className="p-3">{r.leads}</td>
                  <td className="p-3">{r.optedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="all-leads">
        <h2 id="all-leads" className="mb-2 text-xl font-bold">
          {leads.length} leads
        </h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Date", "Email", "Name", "Class", "Updates", "Campaign", "Source / medium", "Landing page"].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b last:border-0" data-testid="lead-row">
                  <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                  <td className="p-3">{l.parent_email}</td>
                  <td className="p-3">{l.parent_name}</td>
                  <td className="p-3">{l.child_class}</td>
                  <td className="p-3">{l.marketing_consent ? "yes" : "no"}</td>
                  <td className="p-3">{l.utm_campaign}</td>
                  <td className="p-3">
                    {l.utm_source} {l.utm_medium && `/ ${l.utm_medium}`} {l.click_id_type && `(${l.click_id_type})`}
                  </td>
                  <td className="p-3">{l.landing_path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
