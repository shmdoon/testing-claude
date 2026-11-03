import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page explains activity-first learning and links to signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn AI by doing");
    await expect(page.getByRole("heading", { name: "How activity-first learning works" })).toBeVisible();
    for (const step of ["Try it", "Notice", "Understand", "Check"]) {
      await expect(page.getByRole("heading", { name: step, exact: true })).toBeVisible();
    }
    // Session-dependent header streams in after the static shell.
    await expect(page.getByRole("banner").getByRole("link", { name: "Create account" })).toBeVisible();
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
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
  for (const path of ["/learn", "/parent", "/admin/payments", "/studio"]) {
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

  test("student signup asks for class and parent email; parent signup does not", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Your class")).toBeVisible();
    await expect(page.getByLabel("Parent or guardian's email")).toBeVisible();
    await page.getByText("Parent or guardian", { exact: true }).click();
    await expect(page.getByLabel("Parent or guardian's email")).toBeHidden();
    await expect(page.getByLabel("Your name")).toBeVisible();
  });

  test("student signup rejects own email as parent email", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Asha");
    await page.getByLabel("Your class").selectOption("7");
    await page.getByLabel("Parent or guardian's email").fill("asha@example.com");
    await page.getByLabel("Email address").fill("asha@example.com");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("The parent email must be different from your own.")).toBeVisible();
  });
});
