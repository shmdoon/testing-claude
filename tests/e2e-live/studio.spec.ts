import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

const slug = `e2e-course-${RUN}`;
let editor: { id: string; email: string };

test.beforeAll(async () => {
  editor = await createUser("content_editor");
});

test.afterAll(async () => {
  await admin.from("courses").delete().eq("slug", slug);
  await admin.from("audit_log").delete().eq("actor_id", editor.id);
  await deleteUser(editor.id);
});

test("editor builds, publishes and sees a course in the catalogue", async ({ page }) => {
  await signIn(page, editor.email);
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();

  // Editors can't reach admin.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/studio$/);

  // Create a free mini course.
  await page.getByRole("link", { name: "New course" }).click();
  await page.getByLabel("Title", { exact: true }).fill(`E2E Course ${RUN}`);
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Free course").check();
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { name: `E2E Course ${RUN}` })).toBeVisible();

  // Mini courses start with a "Lessons" module. Add two lessons.
  const mod = page.getByTestId("module").first();
  await expect(mod.getByRole("heading", { name: "Lessons" })).toBeVisible();
  await mod.getByRole("button", { name: "Add lesson" }).click();
  await mod.getByLabel("Lesson title").fill("Second lesson");
  await mod.getByRole("button", { name: "Create lesson" }).click();
  await expect(page.getByRole("heading", { name: "Second lesson" })).toBeVisible();
  await page.getByRole("link", { name: `E2E Course ${RUN}` }).click();
  await page.getByTestId("module").first().getByRole("button", { name: "Add lesson" }).click();
  await page.getByTestId("module").first().getByLabel("Lesson title").fill("First lesson");
  await page.getByTestId("module").first().getByRole("button", { name: "Create lesson" }).click();
  await expect(page.getByRole("heading", { name: "First lesson" })).toBeVisible();

  // Build the lesson from blocks; publish is disabled until it has an activity + module block.
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeDisabled();
  await page.getByLabel("Add a block").selectOption("multiple_choice_explore");
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByLabel("Add a block").selectOption("rich_text");
  await page.getByRole("button", { name: "Add block" }).click();

  // Invalid JSON is caught live.
  const props = page.getByLabel("Properties (JSON)").last();
  await props.fill("{ oops");
  await expect(page.getByText("Some blocks have errors")).toBeVisible();
  await expect(publish).toBeDisabled();
  await props.fill(JSON.stringify({ markdown: "## Why it works\n\nBecause **examples**." }));
  await expect(publish).toBeEnabled();

  await page.getByRole("tab", { name: "Preview lesson" }).click();
  await expect(page.getByText("1 · Activity")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why it works" })).toBeVisible();

  await publish.click();
  await expect(page.getByText("Published as a new version.")).toBeVisible();
  await expect(page.getByText("v1")).toBeVisible();

  // Reorder: move "First lesson" above "Second lesson" with the keyboard-friendly button.
  await page.getByRole("link", { name: `E2E Course ${RUN}` }).click();
  await page.getByRole("button", { name: "Move First lesson up" }).click();
  await expect(page.getByTestId("module").first().getByRole("link").first()).toHaveText("First lesson");
  await page.reload();
  await expect(page.getByTestId("module").first().getByRole("link").first()).toHaveText("First lesson");

  // Publish the course and find it in the public catalogue.
  await page.getByRole("button", { name: "Publish course" }).click();
  await expect(page.getByText("Course published.")).toBeVisible();
  await page.goto("/courses?price=free");
  await expect(page.getByRole("link", { name: new RegExp(`E2E Course ${RUN}`) })).toBeVisible();
  await page.goto(`/courses/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: `E2E Course ${RUN}` })).toBeVisible();
  await expect(page.getByText("First lesson")).toBeVisible();

  // The publish was audited.
  const { count } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_id", editor.id).eq("action", "lesson.published");
  expect(count).toBe(1);
});
