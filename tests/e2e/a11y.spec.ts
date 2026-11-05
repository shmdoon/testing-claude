import { test } from "@playwright/test";
import { expectNoA11yViolations } from "../shared/axe";

const PAGES = [
  "/",
  "/lp/ai-for-kids",
  "/courses",
  "/login",
  "/signup",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refund",
  "/consent/not-a-real-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "/pay/not-a-real-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "/does-not-exist",
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoA11yViolations(page);
      });
    }
  });
}
