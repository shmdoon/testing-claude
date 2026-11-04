import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, lastWhatsApp, linkIn, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const COUPON = `E2E${RUN.toUpperCase().slice(-6)}`;
let kid: { id: string; email: string };
let kid2: { id: string; email: string };
let adminUser: { id: string; email: string };
let originalSettings: { key: string; value: unknown }[] = [];

test.beforeAll(async () => {
  kid = await createUser("student", { full_name: "Asha Test", class_level: "8", parent_name: "Meera Test" });
  kid2 = await createUser("student", { full_name: "Ravi Test", class_level: "7", parent_phone: "91234 56789", parent_email: `e2e-parentmail-${RUN}@example.com` });
  adminUser = await createUser("admin");
  await admin.from("profiles").update({ account_status: "active" }).in("id", [kid.id, kid2.id]);
  await admin.from("coupons").insert({ code: COUPON, kind: "percent", value: 10 });
  const { data } = await admin.from("settings").select("key, value");
  originalSettings = data ?? [];
});
test.afterAll(async () => {
  for (const s of originalSettings) await admin.from("settings").update({ value: s.value as never }).eq("key", s.key);
  for (const u of [kid, kid2, adminUser]) if (u) await deleteUser(u.id);
  await admin.from("coupons").delete().eq("code", COUPON);
});

test("in-app payment (parent with the child): payer details, coupon, failed attempt, unlock, invoice on WhatsApp", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, kid.email);
  await page.goto("/courses/ai-explorers");
  await page.getByRole("link", { name: "Buy for ₹499" }).click();
  await expect(page).toHaveURL(/\/learn\/checkout\/ai-explorers$/);
  await expect(page.getByText("Test mode: no real money is charged.")).toBeVisible();
  await expect(page.getByLabel("Parent or guardian's name")).toHaveValue("Meera Test");
  await expect(page.getByLabel("WhatsApp number (for the invoice)")).toHaveValue("+919876543210");

  await page.getByLabel("Coupon code (optional)").fill(COUPON);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("total")).toHaveText("₹449.10");

  // The 18+ payer confirmation is required.
  await page.getByRole("button", { name: "Pay ₹449.10" }).click();
  await expect(page.getByText("A parent or guardian (18+) must make the payment.")).toBeVisible();
  await page.getByLabel(/I am the student's parent or guardian/).check();

  await page.getByRole("button", { name: "Pay ₹449.10" }).click();
  await page.getByRole("button", { name: "Simulate a failed payment" }).click();
  await expect(page.getByText("The payment didn't go through")).toBeVisible();

  await page.getByRole("button", { name: "Pay ₹449.10" }).click();
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await expect(page).toHaveURL(/\/learn\/ai-explorers\?paid=1/, { timeout: 20_000 });
  await expect(page.getByText("Payment received — the course is unlocked!")).toBeVisible();
  await page.goto("/learn/ai-explorers/fill-the-gaps");
  await expect(page.getByRole("heading", { level: 2, name: "Try it first" })).toBeVisible();

  const { data: orders } = await admin.from("orders").select("status, total_paise, payer_name, payer_phone").eq("buyer_id", kid.id).order("created_at");
  expect(orders?.map((o) => o.status)).toEqual(["failed", "paid"]);
  expect(orders?.[1]).toMatchObject({ total_paise: 44910, payer_name: "Meera Test", payer_phone: "+919876543210" });
  const { data: inv } = await admin.from("invoices").select("buyer_name, buyer_phone, buyer_email, student_name").eq("buyer_id", kid.id).single();
  expect(inv).toEqual({ buyer_name: "Meera Test", buyer_phone: "+919876543210", buyer_email: null, student_name: "Asha Test" });

  // Invoice goes to the parent on WhatsApp (manual outbox until API keys are set) with a signed link.
  const msg = await lastWhatsApp(kid.id, "invoice_ready");
  expect(msg).toMatchObject({ status: "manual", to_phone: "+919876543210" });
  const signed = await page.request.get(linkIn(msg!.body), { maxRedirects: 0 });
  expect(signed.status()).toBe(303);
  const pdf = await fetch(signed.headers()["location"]!);
  expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");

  // The student's purchases page lists it.
  await page.goto("/learn/purchases");
  await expect(page.getByRole("link", { name: /Invoice TEST-TINV\// })).toBeVisible();
  await expect(page.getByText("paid by Meera Test")).toBeVisible();
  await expect(page.getByText("attempted by Meera Test")).toBeVisible(); // the failed attempt
});

test("ask my parent to pay: WhatsApp payment link → parent pays without logging in", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signIn(page, kid2.email);
  await page.goto("/learn/ai-explorers");
  await page.getByRole("button", { name: "Ask my parent to pay on WhatsApp" }).click();
  await expect(page.getByText(/payment link will be sent to your parent on WhatsApp|Sent!/)).toBeVisible();
  const msg = await lastWhatsApp(kid2.id, "payment_link");
  expect(msg?.to_phone).toBe("+919123456789");
  expect(msg?.body).toContain("Ravi would like to join \"AI Explorers\"");
  const link = linkIn(msg!.body).replace(/^https?:\/\/[^/]+/, "");

  // The parent opens the link on their own phone: no session at all.
  const ctx = await browser.newContext();
  const parent = await ctx.newPage();
  await parent.goto(link);
  await expect(parent.getByRole("heading", { name: "Pay for Ravi's course" })).toBeVisible();
  await parent.getByLabel("Parent or guardian's name").fill("Kiran Test");
  await parent.getByLabel(/I am the student's parent or guardian/).check();
  await parent.getByRole("button", { name: "Pay ₹499" }).click();
  await parent.getByRole("button", { name: "Pay (test)" }).click();
  await expect(parent.getByText("Paid — thank you! Ravi can start the course now.")).toBeVisible({ timeout: 20_000 });
  // Link can't be reused.
  await parent.goto(link);
  await expect(parent.getByText(/Paid — thank you/)).toBeVisible();
  await ctx.close();

  const { data: enr } = await admin.from("enrollments").select("status, source").eq("user_id", kid2.id).single();
  expect(enr).toEqual({ status: "active", source: "purchase" });
  const { data: inv } = await admin.from("invoices").select("buyer_name, buyer_email").eq("buyer_id", kid2.id).single();
  expect(inv).toEqual({ buyer_name: "Kiran Test", buyer_email: `e2e-parentmail-${RUN}@example.com` });
  const { data: mail } = await admin.from("email_log").select("template").eq("to_email", `e2e-parentmail-${RUN}@example.com`);
  expect(mail).toContainEqual({ template: "invoice" });
  await admin.from("email_log").delete().eq("to_email", `e2e-parentmail-${RUN}@example.com`);
});

test("admin refund: access revoked, credit note + WhatsApp refund message, CSV", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, adminUser.email);
  await page.goto("/admin/payments?status=paid");
  const row = page.getByTestId("order-row").filter({ hasText: "Asha Test" });
  await row.getByRole("button", { name: "Refund" }).click();
  await row.getByLabel(/Reason for refunding/).fill("Parent asked within the refund window");
  await row.getByRole("button", { name: "Confirm full refund" }).click();
  await expect(page.getByText("Refunded. Access revoked and credit note sent.")).toBeVisible({ timeout: 20_000 });

  const { data: enr } = await admin.from("enrollments").select("status").eq("user_id", kid.id).single();
  expect(enr?.status).toBe("revoked");
  expect((await lastWhatsApp(kid.id, "refund_processed"))?.body).toContain("We've refunded INR 449.10");
  const csv = await (await page.request.get("/api/admin/payments-csv?status=refunded")).text();
  expect(csv.split("\r\n")[0]).toContain("order_id,created_at,status");

  // Outbox: one-tap manual sending.
  await page.goto("/admin/whatsapp");
  const item = page.getByTestId("wa-row").filter({ hasText: "Refund" }).filter({ hasText: "Asha Test" });
  await expect(item.getByRole("link", { name: /Open in WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=/);
  await item.getByRole("button", { name: "Mark as sent" }).click();
  await expect(item.getByText("Marked as sent")).toBeVisible();
});

test("webhook + verify endpoints reject forgeries and replays", async ({ request }) => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_forged", order_id: "order_x", amount: 1, status: "captured" } } } });
  const bad = await request.post("/api/webhooks/razorpay", { data: body, headers: { "content-type": "application/json", "x-razorpay-signature": "0".repeat(64) } });
  expect(bad.status()).toBe(400);
  const sig = createHmac("sha256", "mock_webhook_secret_local_only").update(body).digest("hex");
  const headers = { "content-type": "application/json", "x-razorpay-signature": sig, "x-razorpay-event-id": `evt_e2e_${RUN}` };
  expect((await (await request.post("/api/webhooks/razorpay", { data: body, headers })).json()).result).toBe("ignored");
  expect((await (await request.post("/api/webhooks/razorpay", { data: body, headers })).json()).result).toBe("duplicate");
  const verify = await request.post("/api/payments/verify", {
    data: { order_id: "00000000-0000-4000-8000-000000000000", razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "a".repeat(64) },
  });
  expect(verify.status()).toBe(401);
  const forgedLink = await request.post("/api/payments/verify", {
    data: { order_id: "00000000-0000-4000-8000-000000000000", pay_token: "x".repeat(43), razorpay_order_id: "x", razorpay_payment_id: "y", razorpay_signature: "a".repeat(64) },
  });
  expect(forgedLink.status()).toBe(401);
  const badInvoiceLink = await request.get("/api/invoices/link/00000000-0000-4000-8000-000000000000.9999999999." + "a".repeat(64), { maxRedirects: 0 });
  expect(badInvoiceLink.status()).toBe(404);
});

test("admin settings: GST needs a GSTIN; changes are audited; coupons UI", async ({ page }) => {
  await signIn(page, adminUser.email);
  await page.goto("/admin/settings");
  await page.getByLabel("GST treatment").selectOption("cgst_sgst");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Add a GSTIN before charging GST.")).toBeVisible();
  await page.getByLabel("GSTIN (leave empty if not registered)").fill("29ABCDE1234F1Z5");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Saved \(\d+ changed\)/)).toBeVisible();
  await page.goto("/admin/coupons");
  await page.getByLabel("Code").fill(`${COUPON}F`);
  await page.getByLabel("Type").selectOption("flat");
  await page.getByLabel("Value (% or ₹)").fill("100");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText(`Coupon ${COUPON}F created.`)).toBeVisible();
  await admin.from("coupons").delete().eq("code", `${COUPON}F`);
});
