import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.1 A/AA checks; fails with a readable list of violations. */
export async function expectNoA11yViolations(page: Page, opts: { exclude?: string[] } = {}) {
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]);
  for (const sel of opts.exclude ?? []) b = b.exclude(sel);
  const { violations } = await b.analyze();
  const report = violations.map((v) => `${v.impact} ${v.id}: ${v.help}\n${v.nodes.slice(0, 5).map((n) => `   ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`).join("\n")}`);
  expect(report, `${page.url()}\n${report.join("\n")}`).toEqual([]);
}
