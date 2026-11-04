import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("parent landing page: hero, how it works, safety, FAQ, lead form, sticky CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your child won't just use AI. They'll understand it.");
    await expect(page.getByRole("heading", { name: "How activity-first learning works" })).toBeVisible();
    for (const step of ["Try it", "Notice", "Understand", "Check"]) {
      await expect(page.getByRole("heading", { name: step, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Safe by design" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions parents ask" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Get a free sample lesson" })).toBeVisible();
    // Structured data for search engines.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)).toEqual(expect.arrayContaining([expect.objectContaining({ "@type": "FAQPage" })]));
    // No ad/analytics tags when none are configured.
    await expect(page.locator('script[src*="googletagmanager"], script#meta-pixel')).toHaveCount(0);
    // Header still offers signup.
    await expect(page.getByRole("banner").getByRole("link", { name: "Create account" })).toBeVisible();
  });

  test("lead form validates before saving", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Get a free sample lesson" });
    await form.getByLabel("Your email (parent or guardian)").fill("not-an-email");
    await form.getByRole("button", { name: "Send me the free lesson" }).click();
    await expect(form.getByText("Enter a valid email address.")).toBeVisible();
    await expect(form.getByText("Please confirm you're a parent or guardian.")).toBeVisible();
    await expect(form.getByLabel("Your email (parent or guardian)")).toHaveValue("not-an-email");
  });

  test("campaign landing variants are noindex and canonical to /", async ({ page }) => {
    await page.goto("/lp/screen-time?utm_source=meta&utm_campaign=screen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn screen time into building time");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
    const res = await page.goto("/lp/not-a-campaign");
    expect(res?.status()).toBe(404);
  });

  test("first-touch attribution cookie is set from UTM links (httpOnly)", async ({ page, context }) => {
    await page.goto("/lp/ai-for-kids?utm_source=google&utm_medium=cpc&utm_campaign=launch&gclid=abc");
    const c = (await context.cookies()).find((x) => x.name === "alh_attr");
    expect(c?.httpOnly).toBe(true);
    const decoded = JSON.parse(Buffer.from(c!.value, "base64url").toString());
    expect(decoded).toMatchObject({ utm_source: "google", utm_medium: "cpc", utm_campaign: "launch", click_id_type: "gclid", landing_path: "/lp/ai-for-kids" });
    expect(c!.value).not.toContain("abc");
    // First touch wins.
    await page.goto("/?utm_source=other");
    expect((await context.cookies()).find((x) => x.name === "alh_attr")?.value).toBe(c!.value);
  });

  test("robots.txt and sitemap.xml", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /learn");
    expect(robots).toContain("Disallow: /lp/");
    expect(robots).toContain("Sitemap:");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>");
    const og = await request.get("/opengraph-image");
    expect(og.headers()["content-type"]).toContain("image/png");
  });

  test("legal pages and catalogue render", async ({ page }) => {
    for (const [path, title] of [
      ["/legal/privacy", "Privacy policy"],
      ["/legal/terms", "Terms of use"],
      ["/legal/refund", "Refund policy"],
      ["/courses", "Courses"],
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    }
  });

  test("dark mode toggle", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(html).toHaveClass(/dark/);
  });
});

test.describe("auth gates", () => {
  for (const path of ["/learn", "/learn/checkout/ai-explorers", "/admin/payments", "/studio"]) {
    test(`signed-out visitor to ${path} is sent to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}`));
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    });
  }

  test("login validates email before contacting the server", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("one account per child: signup asks for the parent's WhatsApp, no parent role", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("I am a…")).toHaveCount(0);
    await expect(page.getByLabel("Student's name")).toBeVisible();
    await expect(page.getByLabel("Your class")).toBeVisible();
    await expect(page.getByLabel("Parent's WhatsApp number")).toBeVisible();
    await expect(page.getByLabel("Parent's email (optional, for invoices)")).toBeVisible();
    const res = await page.goto("/parent");
    expect(res?.status()).toBe(404);
  });

  test("signup validates the WhatsApp number, agreement and parent email", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Student's name").fill("Asha");
    await page.getByLabel("Your class").selectOption("7");
    await page.getByLabel("Parent's WhatsApp number").fill("12345");
    await page.getByLabel("Parent's email (optional, for invoices)").fill("asha@example.com");
    await page.getByLabel("Student's email (used to sign in)").fill("asha@example.com");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid WhatsApp number, e.g. 98765 43210.")).toBeVisible();
    await expect(page.getByText("Please confirm the parent agrees to WhatsApp messages.")).toBeVisible();
    await expect(page.getByLabel("Parent's WhatsApp number")).toHaveValue("12345"); // input kept
    await page.getByLabel("Parent's WhatsApp number").fill("98765 43210");
    await page.getByLabel(/agrees to receive messages/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("The parent email must be different from your own.")).toBeVisible();
  });
});
