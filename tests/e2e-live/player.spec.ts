import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const users: string[] = [];
async function student(classLevel: "7" | "8", active = true) {
  const u = await createUser("student", { class_level: classLevel, parent_email: `parent-${RUN}-${Math.random().toString(36).slice(2, 6)}@example.com` });
  users.push(u.id);
  if (active) await admin.from("profiles").update({ account_status: "active" }).eq("id", u.id);
  return u;
}
async function enrolPaid(userId: string) {
  const { data } = await admin.from("courses").select("id").eq("slug", "ai-explorers").single();
  await admin.from("enrollments").insert({ user_id: userId, course_id: data!.id, source: "admin" });
}
test.afterAll(async () => {
  for (const id of users) {
    await admin.storage.from("submissions").list(id).then(async ({ data }) => {
      if (data?.length) await admin.storage.from("submissions").remove(data.map((f) => `${id}/${f.name}`));
    });
    await admin.from("audit_log").delete().eq("actor_id", id);
    await deleteUser(id);
  }
});

async function continueTo(page: Page, heading: string) {
  await page.getByRole("button", { name: /Continue|Finish/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
}

test("free course: enrol, activity-first gating, reflection, module, quiz retry, completion", async ({ page }) => {
  const s = await student("8");
  await signIn(page, s.email);

  await page.goto("/courses/what-is-ai");
  await page.getByRole("link", { name: "Start learning for free" }).click();
  await expect(page).toHaveURL(/\/learn\/what-is-ai$/);
  await page.getByRole("button", { name: "Enroll for free" }).click();
  await expect(page.getByText("0 of 2 lessons done")).toBeVisible();

  await page.getByRole("link", { name: /Spot the AI/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Try it first" })).toBeVisible();

  // Activity-first: module + quiz content isn't even in the page yet; quiz answers never are.
  const html = await page.content();
  expect(html).not.toContain("Rules vs. learning");
  expect(html).not.toContain("correct_option_id");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText("Have a go at the activity first.")).toBeVisible();

  await page.getByRole("button", { name: "A video app choosing what to show you next" }).click();
  await expect(page.getByText("learned from millions of viewers").filter({ visible: true })).toBeVisible();

  await continueTo(page, "What did you notice?");
  const reflection = page.getByLabel("What did the AI examples have in common that the others didn't?");
  await reflection.fill("too short");
  await expect(page.getByRole("button", { name: "Save my answer" })).toBeDisabled();
  await reflection.fill("The AI ones learned from lots of examples instead of fixed rules.");
  await page.getByRole("button", { name: "Save my answer" }).click();
  await expect(page.getByText("✓ Saved")).toBeVisible();

  await continueTo(page, "Here's the idea behind it");
  await expect(page.getByRole("heading", { name: "Rules vs. learning" })).toBeVisible();
  await expect(page.getByRole("img", { name: /labelled examples/ })).toBeVisible();

  await continueTo(page, "Quick check");
  await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled();
  // Wrong first…
  await page.getByLabel("It is always faster").check();
  await page.getByRole("radio", { name: "True" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText(/You scored 0%/)).toBeVisible();
  await expect(page.getByText("The answer was: It learns patterns from examples")).toBeVisible();
  // …then right.
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByLabel("It learns patterns from examples").check();
  await page.getByRole("radio", { name: "False" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("You scored 100% — passed!")).toBeVisible();

  await continueTo(page, "Lesson finished");
  await expect(page.getByText("Lesson complete! 🎉")).toBeVisible();
  await page.getByRole("link", { name: /Next: Learning from examples/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Learning from examples" })).toBeVisible();

  const { data: prog } = await admin.from("lesson_progress").select("status, quiz_score, lessons(slug)").eq("user_id", s.id);
  expect(prog?.find((p) => p.lessons?.slug === "spot-the-ai")).toMatchObject({ status: "completed", quiz_score: 100 });
  const { data: events } = await admin.from("learning_events").select("event_type").eq("user_id", s.id);
  const types = new Set(events?.map((e) => e.event_type));
  for (const t of ["lesson_started", "activity_completed", "reflection_saved", "quiz_submitted", "lesson_completed"]) expect(types).toContain(t);

  // Dashboard shows progress and the resume card.
  await page.goto("/learn");
  await expect(page.getByText("1 of 2 lessons done")).toBeVisible();
  await expect(page.getByText("Continue where you left off")).toBeVisible();
});

test("external task: launch in new tab, return, screenshot (EXIF stripped), revision, URL, approval completes", async ({ page, context }) => {
  const s = await student("8");
  await enrolPaid(s.id);
  await context.route("https://app.netlify.com/**", (r) => r.fulfill({ status: 200, body: "<h1>Netlify Drop (stub)</h1>", contentType: "text/html" }));
  await signIn(page, s.email);
  await page.goto("/learn/ai-explorers/publish-your-page");

  await expect(page.getByText("Publish a one-page website about your favourite animal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  const launch = page.getByRole("link", { name: /Launch tool/ });
  await expect(launch).toHaveAttribute("target", "_blank");
  await expect(launch).toHaveAttribute("rel", "noopener noreferrer");

  const [popup] = await Promise.all([context.waitForEvent("page"), launch.click()]);
  await expect(page.getByText("Working in the other tab")).toBeVisible();
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "Submit your work" })).toBeVisible();

  // Screenshot with GPS EXIF → stored without it.
  const exif = Buffer.from("Exif\0\0GPSLatitude=12.97");
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, exif.length + 2]),
    exif,
    Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02]),
    Buffer.from("PIXELS"),
    Buffer.from([0xff, 0xd9]),
  ]);
  await page.getByRole("radio", { name: "Screenshot" }).click();
  await page.getByLabel("Choose a screenshot").setInputFiles({ name: "shot.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Submitted — waiting for your teacher to review.")).toBeVisible({ timeout: 20_000 });

  const { data: sub1 } = await admin.from("external_submissions").select("id, storage_path").eq("user_id", s.id).single();
  const { data: blob } = await admin.storage.from("submissions").download(sub1!.storage_path!);
  const stored = Buffer.from(await blob!.arrayBuffer());
  expect(stored.includes(Buffer.from("GPSLatitude"))).toBe(false);
  expect(stored.includes(Buffer.from("PIXELS"))).toBe(true);

  // Finish the rest of the lesson → awaiting review.
  await continueTo(page, "What did you notice?");
  await page.getByRole("textbox").fill("The AI wrote most of the HTML but I fixed the colours myself.");
  await page.getByRole("button", { name: "Save my answer" }).click();
  await expect(page.getByText("✓ Saved")).toBeVisible();
  await continueTo(page, "Here's the idea behind it");
  await continueTo(page, "Quick check");
  await page.getByLabel("Your home address or phone number").check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("passed!")).toBeVisible();
  await continueTo(page, "Lesson finished");
  await expect(page.getByText("Nearly there!")).toBeVisible();

  // Teacher (content editor) asks for a revision.
  const editor = await createUser("content_editor");
  users.push(editor.id);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: editor.email });
  const ed = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await ed.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: "magiclink" });
  expect((await ed.rpc("review_submission", { p_submission_id: sub1!.id, p_status: "needs_revision", p_feedback: "Please send the link to your site" })).error).toBeNull();

  await page.goto("/learn/ai-explorers/publish-your-page");
  await expect(page.getByText("Please send the link to your site")).toBeVisible();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Paste your link").fill("https://evil.example.com");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/must be on \*\.netlify\.app/)).toBeVisible();
  await expect(page.getByLabel("Paste your link")).toHaveValue("https://evil.example.com"); // kept for fixing
  await page.getByLabel("Paste your link").fill(`https://e2e-${RUN}.netlify.app`);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Submitted — waiting for your teacher to review.")).toBeVisible({ timeout: 20_000 });

  const { data: sub2 } = await admin.from("external_submissions").select("id, url, url_check").eq("user_id", s.id).eq("kind", "url").single();
  expect(sub2?.url).toBe(`https://e2e-${RUN}.netlify.app/`);
  expect(sub2?.url_check).toHaveProperty("status");
  expect((await ed.rpc("review_submission", { p_submission_id: sub2!.id, p_status: "approved", p_feedback: "Lovely page!" })).data).toBe("completed");

  await page.goto("/learn/ai-explorers/publish-your-page");
  await expect(page.getByText("Lesson complete! 🎉")).toBeVisible();
  await page.getByRole("button", { name: /Try it/ }).click();
  await expect(page.getByText("Approved by your teacher!")).toBeVisible();
  await expect(page.getByText("Lovely page!")).toBeVisible();
});

test("Class 7 student (≈12) gets the with-parent fallback for a 13+ tool", async ({ page }) => {
  const s = await student("7");
  await enrolPaid(s.id);
  await signIn(page, s.email);
  await page.goto("/learn/ai-explorers/publish-your-page");
  await expect(page.getByText("Do this one with a grown-up")).toBeVisible();
  await expect(page.getByText("Do this with your parent or guardian on their account")).toBeVisible();
  await expect(page.getByRole("link", { name: /Launch tool/ })).toBeVisible();
});

test("pending-consent student can't enrol or open lessons; paid lessons are locked", async ({ page }) => {
  const pending = await student("8", false);
  await signIn(page, pending.email);
  await page.goto("/learn/what-is-ai");
  await expect(page.getByText("We've sent your parent or guardian a WhatsApp message to approve your account").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Enroll for free" })).toHaveCount(0);
  await page.goto("/learn/what-is-ai/spot-the-ai");
  await expect(page.getByRole("heading", { name: "Waiting for your parent or guardian to approve your account" })).toBeVisible();

  const active = await student("8");
  await signIn(page, active.email);
  await page.goto("/learn/ai-explorers/fill-the-gaps");
  await expect(page.getByRole("heading", { name: "Enroll in this course to open this lesson" })).toBeVisible();
  // The free preview lesson of a paid course is open.
  await page.goto("/learn/ai-explorers/sorting-the-world");
  await expect(page.getByRole("heading", { level: 2, name: "Try it first" })).toBeVisible();
});
