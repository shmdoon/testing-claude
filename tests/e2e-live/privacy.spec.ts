import { expect, test } from "@playwright/test";
import { admin, createUser, deleteUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const ids: string[] = [];
let adminUser: { id: string; email: string };
async function student(meta: Record<string, string> = {}, active = true) {
  const u = await createUser("student", { full_name: "Neha Iyer", class_level: "8", parent_name: "Lakshmi Iyer", ...meta });
  ids.push(u.id);
  if (active) await admin.from("profiles").update({ account_status: "active" }).eq("id", u.id);
  return u;
}
test.beforeAll(async () => {
  adminUser = await createUser("admin");
  ids.push(adminUser.id);
});
test.afterAll(async () => {
  for (const id of ids) await deleteUser(id);
});

test("student downloads their data, requests deletion, cancels, re-requests; admin erases (no purchases → login deleted)", async ({ page }) => {
  const s = await student();
  await admin.storage.from("submissions").upload(`${s.id}/proof.png`, new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" });
  await admin.from("learning_events").insert({ user_id: s.id, event_type: "lesson_started" });

  await signIn(page, s.email);
  await page.goto("/learn/profile");
  await expect(page.getByText("+91 98765 •••10")).toBeVisible(); // parent's number, masked

  const dl = await page.request.get("/api/me/export");
  expect(dl.headers()["content-disposition"]).toMatch(/attachment; filename="my-data-/);
  const data = await dl.json();
  expect(data.profile).toMatchObject({ full_name: "Neha Iyer", parent_phone: "+919876543210", parent_name: "Lakshmi Iyer" });
  expect(data.recent_events).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain(s.id); // no internal ids needed

  await page.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByTestId("deletion-pending")).toHaveCount(0); // checkbox is required
  await page.getByLabel("Why are you leaving? (optional)").fill("Moving to another course");
  await page.getByRole("checkbox", { name: /account and learning data will be deleted/ }).check();
  await page.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByTestId("deletion-pending")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("deletion-pending")).toBeVisible();
  await page.getByRole("button", { name: /Keep my account/ }).click();
  await expect(page.getByRole("button", { name: "Request deletion" })).toBeVisible();
  await page.getByLabel("Why are you leaving? (optional)").fill("Moving to another course");
  await page.getByRole("checkbox", { name: /account and learning data will be deleted/ }).check();
  await page.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByTestId("deletion-pending")).toBeVisible();

  await signIn(page, adminUser.email);
  await page.goto("/admin/deletions");
  const row = page.getByTestId("deletion-row").filter({ hasText: "Neha Iyer" });
  await expect(row).toContainText("Moving to another course");
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Delete data now" }).click();
  await expect(row.getByRole("status")).toContainText("Account and data deleted.");

  const { data: gone } = await admin.auth.admin.getUserById(s.id);
  expect(gone?.user ?? null).toBeNull();
  const { data: files } = await admin.storage.from("submissions").list(s.id);
  expect(files ?? []).toHaveLength(0);
  const { data: reqs } = await admin.from("deletion_requests").select("status, student_id, outcome").eq("subject_id", s.id).order("created_at");
  expect(reqs?.map((r) => r.status)).toEqual(["cancelled", "completed"]);
  expect(reqs?.[1]).toMatchObject({ student_id: null, outcome: { mode: "deleted", files: 1 } });
  const { data: audit } = await admin.from("audit_log").select("action").eq("actor_id", adminUser.id).eq("action", "privacy.erased");
  expect(audit).toHaveLength(1);

  await page.goto("/admin/deletions?view=done");
  await expect(page.getByTestId("deletion-row").filter({ hasText: "Deleted account" }).first()).toContainText("completed");
});

test("parent asks on WhatsApp → admin queues it; a student with purchases is anonymised, invoices kept, login disabled", async ({ page }) => {
  const s = await student({ full_name: "Kabir Shah" });
  const { data: course } = await admin.from("courses").select("id, price_paise").eq("slug", "ai-explorers").single();
  const { data: order } = await admin
    .from("orders")
    .insert({ buyer_id: s.id, student_id: s.id, course_id: course!.id, list_price_paise: course!.price_paise, total_paise: course!.price_paise, provider: "mock", provider_order_id: `mock_dr_${s.id}`, payer_name: "Parent Shah", payer_phone: "+919876543210" })
    .select("id")
    .single();
  const { error } = await admin.rpc("fulfill_order", { p_order_id: order!.id, p_provider_payment_id: `pay_dr_${s.id}`, p_amount_paise: course!.price_paise, p_method: "upi" });
  expect(error).toBeNull();

  await signIn(page, adminUser.email);
  await page.goto(`/admin/students/${s.id}`);
  await page.getByRole("button", { name: "Add to deletion queue" }).click();
  await expect(page.getByText("Write how the parent asked")).toBeVisible();
  await page.getByLabel(/Parent asked to delete this account/).fill("WhatsApp message from parent, 5 Nov");
  await page.getByRole("button", { name: "Add to deletion queue" }).click();
  await expect(page.getByRole("status")).toContainText("deletion queue");

  await page.goto("/admin/deletions");
  const row = page.getByTestId("deletion-row").filter({ hasText: "Kabir Shah" });
  await expect(row).toContainText("Parent (via admin)");
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Delete data now" }).click();
  await expect(row.getByRole("status")).toContainText("Invoices are kept");

  const { data: p } = await admin.from("profiles").select("full_name, parent_phone, account_status, email").eq("id", s.id).single();
  expect(p).toEqual({ full_name: null, parent_phone: null, account_status: "deleted", email: `deleted-${s.id}@deleted.invalid` });
  const { data: u } = await admin.auth.admin.getUserById(s.id);
  expect(new Date(u!.user!.banned_until!).getFullYear()).toBeGreaterThan(2100);
  const { count: invoices } = await admin.from("invoices").select("id", { count: "exact", head: true }).eq("buyer_id", s.id);
  expect(invoices).toBe(1);
  const { count: enrol } = await admin.from("enrollments").select("id", { count: "exact", head: true }).eq("user_id", s.id);
  expect(enrol).toBe(0);
  // The old email no longer belongs to any account (sign-in never creates accounts).
  const { count: byEmail } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("email", s.email);
  expect(byEmail).toBe(0);
});

test("daily clean-up removes accounts never approved by a parent after 30 days; needs the cron secret", async ({ request }) => {
  const old = await student({ full_name: "Old Pending" }, false);
  const recent = await student({ full_name: "New Pending" }, false);
  await admin.from("profiles").update({ created_at: new Date(Date.now() - 31 * 864e5).toISOString() }).eq("id", old.id);

  expect((await request.post("/api/cron/cleanup")).status()).toBe(401);
  expect((await request.post("/api/cron/cleanup", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  const r = await request.post("/api/cron/cleanup", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(r.status()).toBe(200);
  expect((await r.json()).purgedPending).toBeGreaterThanOrEqual(1);

  expect((await admin.auth.admin.getUserById(old.id)).data?.user ?? null).toBeNull();
  const { data: still } = await admin.from("profiles").select("account_status").eq("id", recent.id).single();
  expect(still?.account_status).toBe("pending_consent");
  const { data: rec } = await admin.from("deletion_requests").select("source, status").eq("subject_id", old.id).single();
  expect(rec).toEqual({ source: "auto", status: "completed" });
});

test("legal pages use the business details from admin settings", async ({ page }) => {
  const { data: before } = await admin.from("settings").select("value").eq("key", "legal.grievance_officer").single();
  try {
    await signIn(page, adminUser.email);
    await page.goto("/admin/settings");
    await page.getByLabel("Grievance officer (name)").fill("Priya Test Officer");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await page.goto("/legal/privacy");
    await expect(page.getByText("Priya Test Officer").first()).toBeVisible();
    await expect(page.getByTestId("legal-draft")).toBeVisible(); // not marked reviewed
  } finally {
    await admin.from("settings").update({ value: before!.value }).eq("key", "legal.grievance_officer");
  }
});
