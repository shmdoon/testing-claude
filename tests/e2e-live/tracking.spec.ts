import { expect, test } from "@playwright/test";
import { admin, createUser, deleteUser, signIn } from "./helpers";

let s: { id: string; email: string };
test.beforeAll(async () => {
  s = await createUser("student", { class_level: "8", parent_email: `p-${Date.now()}@example.com` });
  await admin.from("profiles").update({ account_status: "active" }).eq("id", s.id);
  for (const slug of ["what-is-ai", "ai-explorers"]) {
    const { data } = await admin.from("courses").select("id").eq("slug", slug).single();
    await admin.from("enrollments").insert({ user_id: s.id, course_id: data!.id, source: "admin" });
  }
});
test.afterAll(async () => deleteUser(s.id));

const activeSeconds = async () => {
  const { data } = await admin.from("activity_minutes").select("seconds").eq("user_id", s.id);
  return (data ?? []).reduce((n, r) => n + r.seconds, 0);
};

test("heartbeats: active time aggregated, extras ignored, flush on leave, junk refused", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  await signIn(page, s.email);
  await page.goto("/learn/what-is-ai/spot-the-ai");
  await expect(page.getByRole("heading", { level: 2, name: "Try it first" })).toBeVisible();

  // 31 s of (fake) time with input → one heartbeat of 30 s.
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(100 + i * 10, 200);
    await page.clock.runFor(5_200);
  }
  await expect.poll(activeSeconds, { timeout: 10_000 }).toBe(30);
  const t0 = Date.now();

  // Another 30 s of fake time arrives < 25 s of real time later → the server ignores it.
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(200 + i * 10, 220);
    await page.clock.runFor(5_200);
  }
  await page.waitForTimeout(1_500);
  expect(await activeSeconds()).toBe(30);

  // A few more active seconds (no beat due yet), then leave: the remainder is
  // flushed with sendBeacon and credited only up to the real time elapsed.
  await page.waitForTimeout(4_000);
  await page.mouse.move(300, 300);
  await page.clock.runFor(5_000);
  await page.goto("/learn");
  await expect.poll(activeSeconds, { timeout: 10_000 }).toBeGreaterThan(30);
  const realElapsed = Math.ceil((Date.now() - t0) / 1000) + 1;
  expect(await activeSeconds()).toBeLessThanOrEqual(30 + Math.min(30, realElapsed));

  const { data: rows } = await admin.from("activity_minutes").select("lesson_id, date").eq("user_id", s.id);
  expect(rows).toHaveLength(1); // aggregated: one row per user/day/course/lesson
  const before = await activeSeconds();

  // Cross-site and malformed beats don't count; payload user ids are ignored.
  const course = "00000000-0000-4000-8000-000000000001";
  await page.waitForTimeout(26_000);
  const evil = await page.request.post("/api/track/heartbeat", {
    headers: { origin: "https://evil.example.com", "content-type": "application/json" },
    data: { course_id: course, lesson_id: null, block_id: null, seconds: 30 },
  });
  expect(evil.status()).toBe(204);
  const junk = await page.request.post("/api/track/heartbeat", { data: { course_id: course, seconds: 9999 } });
  expect(junk.status()).toBe(204);
  expect(await activeSeconds()).toBe(before);
});

test("external task away time is stored separately and shown as estimated", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.route("https://app.netlify.com/**", (r) => r.fulfill({ status: 200, body: "stub", contentType: "text/html" }));
  await page.clock.install();
  await signIn(page, s.email);
  await page.goto("/learn/ai-explorers/publish-your-page");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: /Launch tool/ }).click()]);
  await page.clock.runFor(5 * 60_000); // 5 minutes "away"
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "Submit your work" })).toBeVisible();

  await expect
    .poll(async () => (await admin.from("external_task_minutes").select("seconds").eq("user_id", s.id)).data?.[0]?.seconds ?? 0, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(295);
  const { data: ev } = await admin.from("learning_events").select("metadata").eq("user_id", s.id).eq("event_type", "external_task_returned");
  expect(ev?.[0]?.metadata).toMatchObject({ estimated: true });

  await page.goto("/learn");
  await expect(page.getByTestId("week-active")).toBeVisible();
  await expect(page.getByTestId("week-external")).toHaveText("+ 5 min on other websites (estimated)");
});
