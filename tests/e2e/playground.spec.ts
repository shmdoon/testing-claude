import { expect, test, type Page } from "@playwright/test";

/** Drive forward with the keyboard for `ms`; the simulator records ~10 examples per second. */
async function driveForward(page: Page, ms: number) {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(ms);
  await page.keyboard.up("ArrowUp");
}

test.describe("rover playground (no account, no database)", () => {
  test("teach by driving → train → the model drives to the flag → passed", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/playground");
    await expect(page.getByRole("heading", { level: 1, name: "Teach a robot in 2 minutes" })).toBeVisible();
    const sim = page.getByTestId("robot-sim");
    const viewport = sim.getByRole("application");
    await sim.getByRole("button", { name: "Start the rover" }).click();
    await expect(sim.getByRole("button", { name: "Start the rover" })).toHaveCount(0);
    await expect(viewport).toBeFocused();

    // Open field: straight ahead reaches the flag in ~4 s. Drive, reset, drive again.
    await driveForward(page, 4500);
    await sim.getByRole("button", { name: "Reset position" }).click();
    await viewport.click();
    await driveForward(page, 4500);
    await expect(sim.getByText(/Enough to train/)).toBeVisible();
    const examples = Number((await sim.getByText(/^\d+ examples\./).textContent())?.match(/\d+/)?.[0]);
    expect(examples).toBeGreaterThanOrEqual(20);

    await sim.getByRole("button", { name: "Train" }).click();
    await sim.getByRole("button", { name: "Train the model" }).click();
    await expect(sim.getByText("Model trained!")).toBeVisible({ timeout: 15_000 });
    await sim.getByRole("button", { name: "Let it drive" }).first().click();
    await expect(sim.getByText("Hands off!")).toBeVisible();
    await sim.getByRole("button", { name: "Let it drive" }).click();
    await expect(sim.getByRole("status").filter({ hasText: /Reached the flag in/ })).toBeVisible({ timeout: 45_000 });
    await expect(sim.getByText("Project passed — your rover drives itself!")).toBeVisible();
    await expect(page.getByTestId("playground-passed")).toBeVisible();
  });

  test("a model with too few examples can't train; labelling mode isn't offered here", async ({ page }) => {
    await page.goto("/playground");
    const sim = page.getByTestId("robot-sim");
    await sim.getByRole("button", { name: "Train" }).click();
    await expect(sim.getByRole("button", { name: "Train the model" })).toBeDisabled();
    await expect(sim.getByText(/Collect \d+ more examples first/)).toBeVisible();
    await expect(sim.getByRole("button", { name: "Test" })).toBeDisabled();
    await expect(sim.getByRole("button", { name: "Label" })).toHaveCount(0);
    // Switching challenge resets the simulator.
    await page.getByRole("button", { name: "2. Wall ahead" }).click();
    await expect(sim.getByText("A wall blocks the straight path", { exact: false })).toBeVisible();
    await expect(sim.getByText(/0 examples \(need 40\)/)).toBeVisible();
  });
});

test.describe("sound", () => {
  test("the mute toggle flips, is remembered, and marks buttons silent", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Turn sounds off" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    const on = page.getByRole("button", { name: "Turn sounds on" });
    await expect(on).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("sound:muted"))).toBe("1");
    await page.reload();
    await expect(page.getByRole("button", { name: "Turn sounds on" })).toBeVisible();
  });
});
