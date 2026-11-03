import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const COUPON = `E2E${RUN.toUpperCase().slice(-6)}`;
let parent: { id: string; email: string };
let kid: { id: string; email: string };
let adminUser: { id: string; email: string };
let otherParent: { id: string; email: string };
let originalSettings: { key: string; value: unknown }[] = [];

test.beforeAll(async () => {
  parent = await createUser("parent", { full_name: "Meera Test" });
  otherParent = await createUser("parent");
  kid = await createUser("student", { full_name: "Asha Test", class_level: "8", parent_email: parent.email });
  adminUser = await createUser("admin");
  await admin.from("profiles").update({ account_status: "active" }).eq("id", kid.id);
  await admin.from("parent_student_links").insert({ parent_id: parent.id, student_id: kid.id, status: "active" });
  await admin.from("coupons").insert({ code: COUPON, kind: "percent", value: 10 });
  const { data } = await admin.from("settings").select("key, value");
  originalSettings = data ?? [];
});
test.afterAll(async () => {
  for (const s of originalSettings) await admin.from("settings").update({ value: s.value as never }).eq("key", s.key);
  for (const u of [kid, parent, otherParent, adminUser]) if (u) await deleteUser(u.id);
  await admin.from("coupons").delete().eq("code", COUPON);
});

test("parent buys a course: coupon, failed attempt, mock payment, enrolment, invoice PDF + email", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, parent.email);
  await page.goto("/courses/ai-explorers");
  await page.getByRole("link", { name: "Buy for ₹499" }).click();
  await expect(page).toHaveURL(/\/parent\/checkout\/ai-explorers$/);
  await expect(page.getByText("Test mode: no real money is charged.")).toBeVisible();
  await expect(page.getByLabel("Who is this course for?")).toHaveValue(kid.id);

  await page.getByLabel("Coupon code (optional)").fill("NOPE123");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("That coupon code isn't valid.")).toBeVisible();
  await page.getByLabel("Coupon code (optional)").fill(COUPON);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("total")).toHaveText("₹449.10");

  // First attempt fails.
  await page.getByRole("button", { name: "Pay ₹449.10" }).click();
  await page.getByRole("button", { name: "Simulate a failed payment" }).click();
  await expect(page.getByText("The payment didn't go through")).toBeVisible();

  // Second attempt succeeds.
  await page.getByRole("button", { name: "Pay ₹449.10" }).click();
  await expect(page.getByRole("dialog", { name: "Mock checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await expect(page).toHaveURL(/\/parent\/purchases\?order=/, { timeout: 20_000 });
  await expect(page.getByText("Payment received — thank you!")).toBeVisible();
  const invoiceLink = page.getByRole("link", { name: /Invoice TEST-TINV\// });
  await expect(invoiceLink).toBeVisible();

  const { data: orders } = await admin.from("orders").select("id, status, total_paise, discount_paise").eq("buyer_id", parent.id).order("created_at");
  expect(orders?.map((o) => o.status)).toEqual(["failed", "paid"]);
  expect(orders?.[1]).toMatchObject({ total_paise: 44910, discount_paise: 4990 });
  const { data: enr } = await admin.from("enrollments").select("status, source").eq("user_id", kid.id).single();
  expect(enr).toEqual({ status: "active", source: "purchase" });
  const { data: inv } = await admin.from("invoices").select("number, total_paise, is_test, emailed_at, pdf_path").eq("order_id", orders![1]!.id).single();
  expect(inv).toMatchObject({ total_paise: 44910, is_test: true });
  expect(inv?.emailed_at).not.toBeNull();
  const { data: mail } = await admin.from("email_log").select("template, status").eq("to_email", parent.email);
  expect(mail).toContainEqual({ template: "invoice", status: "logged" });
  const { data: coupon } = await admin.from("coupons").select("used_count").eq("code", COUPON).single();
  expect(coupon?.used_count).toBe(1);

  // Invoice download → short-lived signed URL → a real PDF.
  const href = await invoiceLink.getAttribute("href");
  const redirect = await page.request.get(href!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(303);
  const signed = redirect.headers()["location"]!;
  expect(signed).toMatch(/\/storage\/v1\/object\/sign\/invoices\/.+token=/);
  const pdf = await fetch(signed); // Node fetch (uses the environment's proxy)
  expect(pdf.ok).toBe(true);
  expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");

  // Coupon can't be reused by the same buyer.
  await page.goto("/parent/checkout/ai-explorers");
  await expect(page.getByText("Your children already have this course.")).toBeVisible();

  // The student can now open paid lessons.
  await signIn(page, kid.email);
  await page.goto("/learn/ai-explorers/fill-the-gaps");
  await expect(page.getByRole("heading", { level: 2, name: "Try it first" })).toBeVisible();

  // Nobody else can download the invoice.
  await signIn(page, otherParent.email);
  const denied = await page.request.get(href!, { maxRedirects: 0 });
  expect(denied.status()).toBe(404);
});

test("admin refunds: access revoked, credit note issued and emailed, CSV export", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, adminUser.email);
  await page.goto("/admin/payments?status=paid");
  const row = page.getByTestId("order-row").filter({ hasText: "Meera Test" });
  await row.getByRole("button", { name: "Refund" }).click();
  await row.getByLabel(/Reason for refunding/).fill("Parent asked within the refund window");
  await row.getByRole("button", { name: "Confirm full refund" }).click();
  await expect(page.getByText("Refunded. Access revoked and credit note sent.")).toBeVisible({ timeout: 20_000 });

  const { data: order } = await admin.from("orders").select("id, status").eq("buyer_id", parent.id).eq("status", "refunded").single();
  expect(order).toBeTruthy();
  const { data: enr } = await admin.from("enrollments").select("status").eq("user_id", kid.id).single();
  expect(enr?.status).toBe("revoked");
  const { data: cn } = await admin.from("invoices").select("number, kind, total_paise").eq("order_id", order!.id).eq("kind", "credit_note").single();
  expect(cn?.number).toMatch(/^TEST-TCN\//);
  expect(cn?.total_paise).toBe(44910);
  const { data: audit } = await admin.from("audit_log").select("action").eq("actor_id", adminUser.id);
  expect(audit?.map((a) => a.action)).toContain("refund.requested");

  const csv = await page.request.get("/api/admin/payments-csv?status=refunded");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text.split("\r\n")[0]).toContain("order_id,created_at,status");
  expect(text).toContain(order!.id);

  // Parent sees the refund and the credit note.
  await signIn(page, parent.email);
  await page.goto("/parent/purchases");
  await expect(page.getByText("Refunded")).toBeVisible();
  await expect(page.getByRole("link", { name: /Credit note TEST-TCN\// })).toBeVisible();

  // Student lost access.
  await signIn(page, kid.email);
  await page.goto("/learn/ai-explorers/fill-the-gaps");
  await expect(page.getByRole("heading", { name: "Enroll in this course to open this lesson" })).toBeVisible();
});

test("webhook + verify endpoints reject forgeries and replays", async ({ request }) => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_forged", order_id: "order_x", amount: 1, status: "captured" } } } });
  const bad = await request.post("/api/webhooks/razorpay", { data: body, headers: { "content-type": "application/json", "x-razorpay-signature": "0".repeat(64) } });
  expect(bad.status()).toBe(400);

  const sig = createHmac("sha256", "mock_webhook_secret_local_only").update(body).digest("hex");
  const headers = { "content-type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": `evt_e2e_${RUN}` };
  const first = await request.post("/api/webhooks/razorpay", { data: body, headers });
  expect(first.status()).toBe(200);
  expect((await first.json()).result).toBe("ignored"); // unknown order
  const replay = await request.post("/api/webhooks/razorpay", { data: body, headers });
  expect((await replay.json()).result).toBe("duplicate");

  const verify = await request.post("/api/payments/verify", {
    data: { order_id: "00000000-0000-4000-8000-000000000000", razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "a".repeat(64) },
  });
  expect(verify.status()).toBe(401); // not signed in
});

test("admin settings: GST needs a GSTIN; changes are audited; coupons UI", async ({ page }) => {
  await signIn(page, adminUser.email);
  await page.goto("/admin/settings");
  await expect(page.getByText("Mock (test mode — set Razorpay keys to go live)")).toBeVisible();
  await page.getByLabel("GST treatment").selectOption("cgst_sgst");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Add a GSTIN before charging GST.")).toBeVisible();
  await expect(page.getByLabel("GST treatment")).toHaveValue("cgst_sgst"); // input kept
  await page.getByLabel("GSTIN (leave empty if not registered)").fill("29ABCDE1234F1Z5");
  await page.getByLabel("Business name").fill("E2E Learning Pvt Ltd");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Saved \(\d+ changed\)/)).toBeVisible();
  const { data } = await admin.from("settings").select("key, value").in("key", ["tax.mode", "business.gstin", "business.name"]);
  expect(Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))).toEqual({
    "tax.mode": "cgst_sgst",
    "business.gstin": "29ABCDE1234F1Z5",
    "business.name": "E2E Learning Pvt Ltd",
  });
  const { data: audit } = await admin.from("audit_log").select("action").eq("actor_id", adminUser.id).eq("action", "settings.updated");
  expect(audit?.length).toBe(1);

  await page.goto("/admin/coupons");
  await page.getByLabel("Code").fill(`${COUPON}F`);
  await page.getByLabel("Type").selectOption("flat");
  await page.getByLabel("Value (% or ₹)").fill("0.5");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText("Enter at least ₹1")).toBeVisible();
  await page.getByLabel("Value (% or ₹)").fill("100");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText(`Coupon ${COUPON}F created.`)).toBeVisible();
  await admin.from("coupons").delete().eq("code", `${COUPON}F`);
});
