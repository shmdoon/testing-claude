import { expect, test, type Page } from "@playwright/test";
import { admin, createUser, deleteUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

let kid: { id: string; email: string };
test.beforeAll(async () => {
  kid = await createUser("student", { full_name: "Rover Kid", class_level: "8" });
  await admin.from("profiles").update({ account_status: "active" }).eq("id", kid.id);
  const { data: c } = await admin.from("courses").select("id").eq("slug", "physical-ai").single();
  await admin.from("enrollments").insert({ user_id: kid.id, course_id: c!.id, source: "admin" });
});
test.afterAll(async () => {
  await deleteUser(kid.id);
});

async function driveForward(page: Page, ms: number) {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(ms);
  await page.keyboard.up("ArrowUp");
}

test("project ladder lists six rover projects easy → hard; project 1 is next up", async ({ page }) => {
  await signIn(page, kid.email);
  await page.goto("/learn/projects");
  const rows = page.getByTestId("project-row");
  await expect(rows).toHaveCount(6);
  const levels = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-difficulty"))));
  expect(levels).toEqual([...levels].sort((a, b) => a - b));
  expect(levels[0]).toBe(1);
  expect(levels.at(-1)).toBe(5);
  await expect(rows.first()).toContainText("Next up");
  await expect(rows.first()).toContainText("Teach by driving");
  await expect(rows.nth(3)).toContainText("Teach by labelling");
  await expect(page.getByText("0 of 6 projects passed")).toBeVisible();
});

test("project 1: drive, train, autonomous run passes; progress + best time recorded", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, kid.email);
  await page.goto("/learn/physical-ai/drive-to-the-flag");
  const sim = page.getByTestId("robot-sim");
  const viewport = sim.getByRole("application");
  await sim.getByRole("button", { name: "Start the rover" }).click();
  await expect(viewport).toBeFocused();
  await driveForward(page, 4500);
  await sim.getByRole("button", { name: "Reset position" }).click();
  await viewport.click();
  await driveForward(page, 4500);
  await expect(sim.getByText(/Enough to train/)).toBeVisible();

  await sim.getByRole("button", { name: "Train" }).click();
  await sim.getByRole("button", { name: "Train the model" }).click();
  await expect(sim.getByText("Model trained!")).toBeVisible({ timeout: 15_000 });
  await sim.getByRole("button", { name: "Let it drive" }).first().click();
  await sim.getByRole("button", { name: "Let it drive" }).click();
  await expect(sim.getByRole("status").filter({ hasText: /Reached the flag in/ })).toBeVisible({ timeout: 45_000 });
  await expect(sim.getByText("Project passed — your rover drives itself!")).toBeVisible();

  const { data: resp } = await admin.from("block_responses").select("completed, score, response").eq("user_id", kid.id).eq("block_type", "robot_sim").single();
  expect(resp?.completed).toBe(true);
  expect(resp?.score).toBe(100);
  expect((resp?.response as { success: boolean; examples: number }).success).toBe(true);
  expect((resp?.response as { examples: number }).examples).toBeGreaterThanOrEqual(20);

  // Reload keeps the examples; the activity step is done so Continue is enabled.
  await page.reload();
  await expect(sim.getByText(/Enough to train/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

  await page.goto("/learn/projects");
  const first = page.getByTestId("project-row").first();
  await expect(first).toContainText("In progress");
  await expect(first).toContainText(/best \d+(\.\d+)?s/);
});

test("project 4 offers labelling: label situations, then train", async ({ page }) => {
  await signIn(page, kid.email);
  await page.goto("/learn/physical-ai/teach-by-labelling");
  const sim = page.getByTestId("robot-sim");
  await expect(sim.getByText("What should it do?")).toBeVisible();
  await expect(sim.getByRole("button", { name: "Teach" })).toHaveCount(0);
  for (let i = 0; i < 6; i++) await sim.getByRole("button", { name: i % 3 === 0 ? "Forward" : i % 3 === 1 ? "Left" : "Right" }).click();
  await expect(sim.getByText(/6 labelled/)).toBeVisible();
  await sim.getByRole("button", { name: "Train" }).click();
  await expect(sim.getByText(/Collect 24 more examples first/)).toBeVisible();
});
