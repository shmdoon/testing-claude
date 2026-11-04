import { expect, test } from "@playwright/test";

test("catalogue lists seeded courses and filters them", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("link", { name: /What is AI\?/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /AI Explorers/ })).toBeVisible();

  await page.getByLabel("Price").selectOption("paid");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/price=paid/);
  await expect(page.getByRole("link", { name: /AI Explorers/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /What is AI\?/ })).toHaveCount(0);
});

test("course detail shows outcomes, locked lessons, price and the preview activity", async ({ page }) => {
  await page.goto("/courses/ai-explorers");
  await expect(page.getByRole("heading", { level: 1, name: "AI Explorers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What you'll be able to do" })).toBeVisible();
  await expect(page.getByText("Module 2 · Make it real")).toBeVisible();
  await expect(page.getByText("Publish your AI-made web page")).toBeVisible();
  await expect(page.getByText("(Locked)").first()).toBeAttached();
  await expect(page.getByRole("link", { name: "Buy for ₹499" })).toHaveAttribute("href", "/learn/checkout/ai-explorers");
  await expect(page.getByRole("heading", { name: "Try the first activity" })).toBeVisible();
  await expect(page.getByText("Match each input with what an AI might learn")).toBeVisible();
});

test("landing page features published courses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What your child will learn" })).toBeVisible();
  await expect(page.getByRole("link", { name: /What is AI\?/ })).toBeVisible();
});

test("unknown course shows the not-found page and is not indexed", async ({ page }) => {
  // The page streams, so the status stays 200; Next.js adds noindex (documented behaviour).
  await page.goto("/courses/does-not-exist");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
});
