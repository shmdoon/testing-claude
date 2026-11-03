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
test.afterAll(async () => {
  const { data } = await admin.storage.from("submissions").list(s.id);
  if (data?.length) await admin.storage.from("submissions").remove(data.map((f) => `${s.id}/${f.name}`));
  await deleteUser(s.id);
});

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("every activity type works in the player", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, s.email);

  // drag_sort — keyboard-accessible move buttons, then check
  await page.goto("/learn/what-is-ai/learning-from-examples");
  const target = ["Collect lots of fruit photos", "Label each photo: mango or not mango", "Let the computer look for patterns", "Test it on photos it has never seen"];
  for (let i = 0; i < target.length; i++) {
    const items = page.locator("ol[aria-label='Items to sort'] > li");
    for (let guard = 0; guard < 4; guard++) {
      const texts = await items.allInnerTexts();
      const at = texts.findIndex((x) => x.includes(target[i]!));
      if (at <= i) break;
      await page.getByRole("button", { name: `Move ${target[i]} up` }).click();
    }
  }
  await page.getByRole("button", { name: "Check my order" }).click();
  await expect(page.getByText("All correct — nice work!")).toBeVisible();

  // match_pairs — native selects
  await page.goto("/learn/ai-explorers/sorting-the-world");
  for (const [left, right] of [
    ["A photo of a leaf", "Plant disease"],
    ["A voice recording", "The words spoken"],
    ["Past weather readings", "Tomorrow's rain"],
    ["An email", "Spam or not spam"],
  ]) {
    await page.getByLabel(left!).selectOption({ label: right! });
  }
  await page.getByRole("button", { name: "Check my matches" }).click();
  await expect(page.getByText("All correct — nice work!")).toBeVisible();

  // fill_blank — case-insensitive, alternatives
  await page.goto("/learn/ai-explorers/fill-the-gaps");
  await page.getByLabel("Blank 1").fill("Model");
  await page.getByLabel("Blank 2").fill("examples");
  await page.getByLabel("Blank 3").fill("tested");
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText("All correct — nice work!")).toBeVisible();

  // predict_then_reveal — reveal only after locking in
  await page.goto("/learn/ai-explorers/predict-the-robot");
  await expect(page.getByText("bias in the data")).toHaveCount(0);
  await page.getByLabel("Not an apple").check();
  await page.getByRole("button", { name: "Lock in my prediction" }).click();
  await expect(page.getByText("What actually happens")).toBeVisible();

  // embed_sim — sandboxed iframe + acknowledgement
  await page.goto("/learn/ai-explorers/neural-network-playground");
  await expect(page.locator("iframe[title='TensorFlow Playground']")).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
  await page.getByRole("button", { name: "I've tried it" }).click();
  await expect(page.getByText("Nice exploring!")).toBeVisible();

  // checklist_task + upload_work
  await page.goto("/learn/ai-explorers/train-it-offline");
  for (const step of ["Draw 5 happy faces", "Mix them up", "Ask someone to sort them", "Write down what clues"]) {
    await page.getByLabel(new RegExp(step)).check();
  }
  await expect(page.getByText("All steps done — great!")).toBeVisible();
  // A fake "image" is refused by magic-byte sniffing.
  await page.getByLabel(/Choose up to 2 file/).setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText(/Please upload a PNG, JPEG or WebP/)).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Choose up to 2 file/).setInputFiles({ name: "piles.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Uploaded: piles.png")).toBeVisible({ timeout: 15_000 });

  const { data } = await admin.from("block_responses").select("block_type, score, completed").eq("user_id", s.id);
  const byType = Object.fromEntries((data ?? []).map((r) => [r.block_type, r]));
  expect(byType.drag_sort).toMatchObject({ score: 100, completed: true });
  expect(byType.match_pairs).toMatchObject({ score: 100 });
  expect(byType.fill_blank).toMatchObject({ score: 100 });
  expect(byType.checklist_task).toMatchObject({ score: 100, completed: true });
  expect(byType.upload_work).toMatchObject({ completed: true });
});
