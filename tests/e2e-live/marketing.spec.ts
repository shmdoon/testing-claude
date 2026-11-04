import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

const leadEmail = `e2e-lead-${RUN}@example.com`;
let adminUser: { id: string; email: string };
test.beforeAll(async () => {
  adminUser = await createUser("admin");
});
test.afterAll(async () => {
  await admin.from("leads").delete().eq("parent_email", leadEmail);
  await admin.from("email_log").delete().eq("to_email", leadEmail);
  await deleteUser(adminUser.id);
});

test("ad click → campaign page → lead saved with attribution → email → admin leads + CSV", async ({ page }) => {
  await page.goto(`/lp/future-skills?utm_source=google&utm_medium=cpc&utm_campaign=e2e-${RUN}&gclid=XYZ`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The skill every career will need");
  // Live course data on the landing page.
  await expect(page.getByRole("heading", { name: "Simple, one-time prices" })).toBeVisible();
  await expect(page.getByText("₹499").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "See a real activity" })).toBeVisible();

  const form = page.getByRole("form", { name: "Get a free sample lesson" });
  await form.getByLabel("Your email (parent or guardian)").fill(leadEmail);
  await form.getByLabel("Your name (optional)").fill("Kavya");
  await form.getByLabel("Your child's class").selectOption("8");
  await form.getByLabel("I am a parent or guardian (18+)").check();
  await form.getByLabel(/Send me occasional updates/).check();
  await form.getByRole("button", { name: "Send me the free lesson" }).click();
  await expect(page.getByText("Done! Check your inbox for the free lesson link.")).toBeVisible();

  const { data: lead } = await admin.from("leads").select("*").eq("parent_email", leadEmail).single();
  expect(lead).toMatchObject({
    parent_name: "Kavya",
    child_class: 8,
    marketing_consent: true,
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: `e2e-${RUN}`,
    click_id_type: "gclid",
    landing_path: "/lp/future-skills",
    interest: "future-skills",
  });
  expect(lead?.consent_at).not.toBeNull();
  const { data: mail } = await admin.from("email_log").select("template").eq("to_email", leadEmail);
  expect(mail).toEqual([{ template: "lead_welcome" }]);

  await signIn(page, adminUser.email);
  await page.goto(`/admin/leads?campaign=e2e-${RUN}`);
  await expect(page.getByTestId("lead-row")).toHaveCount(1);
  await expect(page.getByRole("cell", { name: leadEmail })).toBeVisible();
  const csv = await (await page.request.get(`/api/admin/leads-csv?campaign=e2e-${RUN}`)).text();
  expect(csv).toContain(leadEmail);
  expect(csv).toContain("gclid");
});

test("signup keeps first-touch campaign (source/medium/campaign only)", async ({ page }) => {
  await page.goto(`/lp/ai-for-kids?utm_source=meta&utm_medium=paid_social&utm_campaign=e2e-signup-${RUN}&fbclid=abc`);
  const email = `e2e-student-${RUN}-signup@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Student's name").fill("Rohan");
  await page.getByLabel("Your class").selectOption("8");
  await page.getByLabel("Parent's WhatsApp number").fill("98765 43210");
  await page.getByLabel(/agrees to receive messages/).check();
  await page.getByLabel("Student's email (used to sign in)").fill(email);
  await page.getByRole("button", { name: "Create account" }).click();
  // Supabase may refuse to email example.com / rate-limit; the account row is what we check.
  await page.waitForTimeout(3_000);
  const { data: profile } = await admin.from("profiles").select("id, acquisition").eq("email", email).maybeSingle();
  test.skip(!profile, "Supabase didn't create the user (email sending refused in this environment)");
  expect(profile!.acquisition).toEqual({ utm_source: "meta", utm_medium: "paid_social", utm_campaign: `e2e-signup-${RUN}` });
  await deleteUser(profile!.id);
});
