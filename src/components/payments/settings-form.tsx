"use client";

import { useActionState } from "react";
import { saveSettings, type AdminState } from "@/lib/payments/admin-actions";
import { FormMessage, Submit, TextField } from "@/components/studio/fields";
import { fieldDefault } from "@/lib/forms";

export function SettingsForm({ values }: { values: Record<string, string> }) {
  const [state, action] = useActionState<AdminState, FormData>(saveSettings, {});
  const fe = state.fieldErrors ?? {};
  const v = state.ok ? undefined : state.values;
  const d = (k: string) => fieldDefault(v, k, values[k]);
  const select = "h-12 w-full rounded-lg border-2 border-input bg-background px-3";
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      <h2 className="text-lg font-bold sm:col-span-2">Business (printed on invoices)</h2>
      <TextField name="business.name" label="Business name" defaultValue={d("business.name")} error={fe["business.name"]} />
      <TextField name="business.email" label="Billing email" defaultValue={d("business.email")} error={fe["business.email"]} />
      <TextField name="business.address" label="Address" multiline rows={3} defaultValue={d("business.address")} error={fe["business.address"]} className="sm:col-span-2" />
      <TextField name="business.gstin" label="GSTIN (leave empty if not registered)" defaultValue={d("business.gstin")} error={fe["business.gstin"]} />

      <h2 className="text-lg font-bold sm:col-span-2">Tax</h2>
      <label className="space-y-2">
        <span className="font-medium">GST treatment</span>
        <select key={d("tax.mode")} name="tax.mode" defaultValue={d("tax.mode")} className={select} aria-invalid={Boolean(fe["tax.mode"])}>
          <option value="none">No GST (not registered)</option>
          <option value="cgst_sgst">CGST + SGST (same state)</option>
          <option value="igst">IGST (other state)</option>
        </select>
        {fe["tax.mode"] && <span className="block text-sm font-medium text-destructive">{fe["tax.mode"]}</span>}
      </label>
      <TextField name="tax.rate_percent" label="GST rate (%)" type="number" min={0} max={28} defaultValue={d("tax.rate_percent")} error={fe["tax.rate_percent"]} />
      <label className="space-y-2">
        <span className="font-medium">Course prices include GST</span>
        <select key={d("tax.prices_include_tax")} name="tax.prices_include_tax" defaultValue={d("tax.prices_include_tax")} className={select}>
          <option value="true">Yes (recommended for consumers)</option>
          <option value="false" disabled>
            No — not supported yet
          </option>
        </select>
      </label>
      <TextField name="invoice.sac_code" label="SAC code" defaultValue={d("invoice.sac_code")} error={fe["invoice.sac_code"]} help="Confirm with your accountant." />

      <h2 className="text-lg font-bold sm:col-span-2">Invoices & refunds</h2>
      <TextField name="invoice.prefix" label="Invoice series" defaultValue={d("invoice.prefix")} error={fe["invoice.prefix"]} help="e.g. INV → INV/2026-27/000001" />
      <TextField name="invoice.credit_note_prefix" label="Credit note series" defaultValue={d("invoice.credit_note_prefix")} error={fe["invoice.credit_note_prefix"]} />
      <TextField name="invoice.footer" label="Invoice footer" defaultValue={d("invoice.footer")} error={fe["invoice.footer"]} className="sm:col-span-2" />
      <TextField name="refund.window_days" label="Refund window (days)" type="number" min={0} max={365} defaultValue={d("refund.window_days")} error={fe["refund.window_days"]} />

      <h2 className="text-lg font-bold sm:col-span-2">Legal pages & privacy</h2>
      <TextField name="platform.support_email" label="Support email (shown to parents)" type="email" defaultValue={d("platform.support_email")} error={fe["platform.support_email"]} help="Empty = billing email." />
      <TextField name="legal.grievance_officer" label="Grievance officer (name)" defaultValue={d("legal.grievance_officer")} error={fe["legal.grievance_officer"]} help="Required by the DPDP Act and e-commerce rules." />
      <TextField name="legal.grievance_email" label="Privacy / grievance email" type="email" defaultValue={d("legal.grievance_email")} error={fe["legal.grievance_email"]} />
      <TextField name="legal.jurisdiction" label="Courts (city, state)" defaultValue={d("legal.jurisdiction")} error={fe["legal.jurisdiction"]} />
      <TextField name="legal.last_updated" label="Legal pages last updated" type="date" defaultValue={d("legal.last_updated")} error={fe["legal.last_updated"]} />
      <label className="space-y-2">
        <span className="font-medium">Reviewed by a lawyer</span>
        <select key={d("legal.reviewed")} name="legal.reviewed" defaultValue={d("legal.reviewed")} className={select}>
          <option value="false">No — show &ldquo;Draft&rdquo; banner</option>
          <option value="true">Yes — remove the banner</option>
        </select>
      </label>

      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <Submit>Save settings</Submit>
      </div>
    </form>
  );
}
