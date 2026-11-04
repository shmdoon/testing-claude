import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

let kid: { id: string; email: string };
let parent: { id: string; email: string };
let editor: { id: string; email: string };
let adminUser: { id: string; email: string };
let other: { id: string; email: string };
const EXT_LESSON = "00000000-0000-4000-8000-000000002006";
const SPOT = "00000000-0000-4000-8000-000000001001";

function istDay(offset: number) {
  return new Date(Date.now() + 5.5 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
}

test.beforeAll(async () => {
  parent = await createUser("parent", { full_name: "Meera Kapoor" });
  kid = await createUser("student", { full_name: "Asha Kapoor", class_level: "8", parent_email: parent.email });
  editor = await createUser("content_editor");
  adminUser = await createUser("admin");
  other = await createUser("parent", { full_name: "Role Test" });
  await admin.from("profiles").update({ account_status: "active" }).eq("id", kid.id);
  await admin.from("parent_student_links").insert({ parent_id: parent.id, student_id: kid.id, status: "active" });
  const { data: courses } = await admin.from("courses").select("id, slug");
  const byslug = Object.fromEntries((courses ?? []).map((c) => [c.slug, c.id]));
  for (const slug of ["what-is-ai", "ai-explorers"]) await admin.from("enrollments").insert({ user_id: kid.id, course_id: byslug[slug]!, source: "admin" });

  // Three consecutive days of activity → 3-day streak.
  await admin.from("activity_minutes").insert([0, -1, -2].map((d) => ({ user_id: kid.id, date: istDay(d), course_id: byslug["what-is-ai"]!, lesson_id: SPOT, seconds: 600 })));
  await admin.from("external_task_minutes").insert({ user_id: kid.id, date: istDay(0), course_id: byslug["ai-explorers"]!, lesson_id: EXT_LESSON, seconds: 900 });
  const { data: spot } = await admin.from("lessons").select("published_version_id").eq("id", SPOT).single();
  await admin.from("lesson_progress").insert({ user_id: kid.id, course_id: byslug["what-is-ai"]!, lesson_id: SPOT, lesson_version_id: spot!.published_version_id!, status: "completed", completed_at: new Date().toISOString(), quiz_score: 100 });
  await admin.from("block_responses").insert({ user_id: kid.id, lesson_id: SPOT, lesson_version_id: spot!.published_version_id!, block_id: "check", block_type: "quiz", score: 100, completed: true });
  const { data: ext } = await admin.from("lessons").select("published_version_id").eq("id", EXT_LESSON).single();
  await admin.from("lesson_progress").insert({ user_id: kid.id, course_id: byslug["ai-explorers"]!, lesson_id: EXT_LESSON, lesson_version_id: ext!.published_version_id! });
  await admin.from("external_submissions").insert({
    user_id: kid.id,
    course_id: byslug["ai-explorers"]!,
    lesson_id: EXT_LESSON,
    lesson_version_id: ext!.published_version_id!,
    block_id: "task",
    kind: "url",
    url: `https://asha-${RUN}.netlify.app/`,
    url_check: { status: "live", httpStatus: 200 },
    share_in_gallery: true,
  });
});
test.afterAll(async () => {
  for (const u of [kid, parent, editor, adminUser, other]) if (u) await deleteUser(u.id);
});

test("student: streak, badges, chart with table + keyboard tooltip, profile name", async ({ page }) => {
  await signIn(page, kid.email);
  await page.goto("/learn");
  await expect(page.getByText("3-day streak")).toBeVisible();

  await page.goto("/learn/achievements");
  await expect(page.getByTestId("streak")).toHaveText("3 days");
  for (const b of ["First steps", "3-day streak", "Sharp mind"]) {
    await expect(page.locator('[data-earned="true"]', { hasText: b })).toBeVisible();
  }
  await expect(page.locator('[data-earned="false"]', { hasText: "Maker" })).toBeVisible();
  // Keyboard: focus the last day's column → tooltip with both series.
  const cols = page.locator('svg rect[tabindex="0"]');
  await expect(cols).toHaveCount(14);
  await cols.last().focus();
  await expect(page.getByRole("status").filter({ hasText: "Active on the platform" })).toContainText("10 min");
  await page.getByText("Show as table").click();
  await expect(page.getByRole("cell", { name: "15 min" })).toBeVisible(); // estimated external today

  await page.goto("/learn/profile");
  await page.getByLabel("Your name").fill("Asha K.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const { data } = await admin.from("profiles").select("full_name").eq("id", kid.id).single();
  expect(data?.full_name).toBe("Asha K.");
});

test("teacher review queue: feedback required for revision, approve completes, editor sees no money", async ({ page }) => {
  await signIn(page, editor.email);
  await page.goto("/studio/submissions");
  const item = page.getByTestId("review-item").filter({ hasText: `asha-${RUN}` });
  await expect(item).toContainText("Asha · Class 8");
  await expect(item).toContainText("live (200)");
  await item.getByRole("button", { name: "Needs revision" }).click();
  await expect(item.getByText("Tell the student what to change.")).toBeVisible();
  await item.getByLabel("Feedback for the student").fill("Great page — well done!");
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(item.getByRole("status")).toContainText("Approved");
  const { data } = await admin.from("external_submissions").select("status, feedback").eq("user_id", kid.id).single();
  expect(data).toEqual({ status: "approved", feedback: "Great page — well done!" });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/studio$/); // editors can't open admin (revenue)
});

test("parent: child card, child detail with chart + feedback, gallery consent → gallery shows first name only", async ({ page }) => {
  await signIn(page, parent.email);
  await page.goto("/parent");
  const card = page.getByTestId("child-card");
  await expect(card).toContainText("Asha K.");
  // Seeded days (today, -1, -2) that fall in this Monday-start IST week, 10 min each.
  const now = new Date(Date.now() + 5.5 * 3600_000);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const inWeek = [0, -1, -2].filter((d) => istDay(d) >= monday.toISOString().slice(0, 10)).length;
  await expect(card).toContainText(`This week${inWeek * 10} min`);
  await expect(card).toContainText("+15 min on other sites (est.)");
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: "Asha K." })).toBeVisible();
  await expect(page.getByText("Teacher: “Great page — well done!”")).toBeVisible();
  await expect(page.locator('svg rect[tabindex="0"]')).toHaveCount(30);

  // Gallery empty until the parent allows it.
  await signIn(page, kid.email);
  await page.goto("/learn/gallery");
  await expect(page.getByText("No projects in the gallery yet.")).toBeVisible();

  await signIn(page, parent.email);
  await page.goto(`/parent/children/${kid.id}`);
  await page.getByRole("switch", { name: /Allow Asha's approved projects/ }).check();
  await expect.poll(async () => (await admin.from("parent_student_links").select("gallery_consent").eq("student_id", kid.id).single()).data?.gallery_consent).toBe(true);

  await signIn(page, kid.email);
  await page.goto("/learn/gallery");
  const g = page.getByTestId("gallery-item");
  await expect(g).toHaveCount(1);
  await expect(g).toContainText("Asha · Class 8");
  await expect(g).not.toContainText("Kapoor");
  await expect(g.getByRole("link", { name: /Open project/ })).toHaveAttribute("rel", /noopener/);

  // Student withdraws from the gallery.
  await page.goto("/learn/profile");
  await page.getByRole("switch", { name: /Show in the class gallery/ }).uncheck();
  await expect.poll(async () => (await admin.from("external_submissions").select("share_in_gallery").eq("user_id", kid.id).single()).data?.share_in_gallery).toBe(false);
});

test("admin: overview, students + detail, engagement + CSV, role change audited", async ({ page }) => {
  await signIn(page, adminUser.email);
  await page.goto("/admin");
  await expect(page.getByText("Active students today")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top courses" })).toBeVisible();

  await page.goto("/admin/students?q=Asha");
  const row = page.getByTestId("student-row").filter({ hasText: kid.email });
  await expect(row).toContainText("30 min");
  await expect(row).toContainText("+15 min est. elsewhere");
  await row.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Asha K." })).toBeVisible();
  await expect(page.getByTestId("lesson-row").filter({ hasText: "Spot the AI" })).toContainText("100%");

  await page.goto(`/admin/engagement?group=course&from=${istDay(-6)}&to=${istDay(0)}`);
  await expect(page.getByTestId("engagement-row").filter({ hasText: "What is AI?" })).toBeVisible();
  const csv = await (await page.request.get(`/api/admin/engagement-csv?group=student&from=${istDay(-6)}&to=${istDay(0)}`)).text();
  expect(csv.split("\r\n")[0]).toBe("group,id,name,detail,students,active_minutes,estimated_external_minutes,lessons_completed,from,to");
  expect(csv).toContain(kid.id);

  page.on("dialog", (d) => d.accept());
  await page.goto(`/admin/users?q=${encodeURIComponent(other.email)}`);
  const u = page.getByTestId("user-row").filter({ hasText: other.email });
  await u.getByLabel("Role").selectOption("content_editor");
  await expect(u.getByText("Role updated.")).toBeVisible();
  const { data: prof } = await admin.from("profiles").select("role").eq("id", other.id).single();
  expect(prof?.role).toBe("content_editor");
  const { data: audit } = await admin.from("audit_log").select("action").eq("actor_id", adminUser.id).eq("action", "user.role_changed");
  expect(audit?.length).toBe(1);
  // Can't change own role.
  await page.goto(`/admin/users?q=${encodeURIComponent(adminUser.email)}`);
  await expect(page.getByTestId("user-row").filter({ hasText: adminUser.email }).getByLabel("Role")).toBeDisabled();
});
