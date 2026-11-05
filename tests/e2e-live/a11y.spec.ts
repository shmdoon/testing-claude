import { expect, test } from "@playwright/test";
import { admin, createUser, deleteUser, lastWhatsApp, linkIn, signIn } from "./helpers";
import { expectNoA11yViolations } from "../shared/axe";

test.describe.configure({ mode: "serial" });

let kid: { id: string; email: string };
let pending: { id: string; email: string };
let editor: { id: string; email: string };
let adminUser: { id: string; email: string };

const LESSONS = [
  "what-is-ai/spot-the-ai",
  "what-is-ai/learning-from-examples",
  "ai-explorers/sorting-the-world",
  "ai-explorers/fill-the-gaps",
  "ai-explorers/predict-the-robot",
  "ai-explorers/neural-network-playground",
  "ai-explorers/train-it-offline",
  "ai-explorers/publish-your-page",
];

test.beforeAll(async () => {
  kid = await createUser("student", { full_name: "Axe Student", class_level: "8" });
  pending = await createUser("student", { full_name: "Axe Pending", class_level: "7" });
  editor = await createUser("content_editor");
  adminUser = await createUser("admin");
  await admin.from("profiles").update({ account_status: "active" }).eq("id", kid.id);
  const { data: courses } = await admin.from("courses").select("id, slug").in("slug", ["what-is-ai", "ai-explorers"]);
  for (const c of courses ?? []) await admin.from("enrollments").insert({ user_id: kid.id, course_id: c.id, source: "admin" });
});
test.afterAll(async () => {
  for (const u of [kid, pending, editor, adminUser]) if (u) await deleteUser(u.id);
});

for (const scheme of ["light", "dark"] as const) {
  test(`student area + every lesson's first activity (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page, kid.email);
    for (const path of ["/learn", "/learn/what-is-ai", "/learn/ai-explorers", "/learn/achievements", "/learn/profile", "/learn/purchases", "/learn/gallery"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page);
    }
    for (const l of LESSONS) {
      await page.goto(`/learn/${l}`);
      await expect(page.getByRole("navigation", { name: /Lesson steps/i })).toBeVisible();
      await expectNoA11yViolations(page);
    }
  });
}

test("lesson player: every step of a lesson after interacting", async ({ page }) => {
  await signIn(page, kid.email);
  await page.goto("/learn/what-is-ai/spot-the-ai");
  await page.getByRole("button", { name: "A video app choosing what to show you next" }).click();
  await expectNoA11yViolations(page); // feedback state
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "What did you notice?" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("keyboard only: reach the activity with Tab, answer and continue with Enter; focus is visible", async ({ page }) => {
  const s = await createUser("student", { full_name: "Key Board", class_level: "8" });
  try {
    await admin.from("profiles").update({ account_status: "active" }).eq("id", s.id);
    const { data: c } = await admin.from("courses").select("id").eq("slug", "what-is-ai").single();
    await admin.from("enrollments").insert({ user_id: s.id, course_id: c!.id, source: "admin" });
    await signIn(page, s.email);
    await page.goto("/learn/what-is-ai/spot-the-ai");
    const option = page.getByRole("button", { name: "A video app choosing what to show you next" });
    await expect(option).toBeVisible();
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await option.evaluate((el) => el === document.activeElement);
    }
    expect(reached, "activity option reachable by Tab").toBe(true);
    const outline = await option.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== "none" || cs.boxShadow !== "none";
    });
    expect(outline, "focus indicator visible").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByText("learned from millions of viewers").filter({ visible: true })).toBeVisible();
    const cont = page.getByRole("button", { name: "Continue" });
    await expect(cont).toBeEnabled(); // after the answer is saved
    await cont.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "What did you notice?" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "What did you notice?" })).toBeFocused(); // focus moves to the new step
  } finally {
    await deleteUser(s.id);
  }
});

test("checkout page", async ({ page }) => {
  const buyer = await createUser("student", { full_name: "Axe Buyer", class_level: "8" });
  try {
    await admin.from("profiles").update({ account_status: "active" }).eq("id", buyer.id);
    await signIn(page, buyer.email);
    await page.goto("/learn/checkout/ai-explorers");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  } finally {
    await deleteUser(buyer.id);
  }
});

test("pending student + parent approval page", async ({ page, browser }) => {
  await signIn(page, pending.email);
  await page.goto("/learn");
  await expectNoA11yViolations(page);
  await expect.poll(async () => (await lastWhatsApp(pending.id, "consent_request"))?.body).toBeTruthy();
  const link = linkIn((await lastWhatsApp(pending.id, "consent_request"))!.body);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(new URL(link).pathname);
  await expectNoA11yViolations(p);
  await ctx.close();
});

test("studio + admin pages", async ({ page }) => {
  await signIn(page, editor.email);
  for (const path of ["/studio", "/studio/submissions"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  }
  await signIn(page, adminUser.email);
  for (const path of [
    "/admin",
    "/admin/students",
    `/admin/students/${kid.id}`,
    "/admin/engagement",
    "/admin/submissions",
    "/admin/whatsapp",
    "/admin/payments",
    "/admin/invoices",
    "/admin/coupons",
    "/admin/leads",
    "/admin/users",
    "/admin/deletions",
    "/admin/tools",
    "/admin/settings",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  }
});
