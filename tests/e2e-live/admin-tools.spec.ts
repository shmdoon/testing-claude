import { expect, test } from "@playwright/test";
import { RUN, admin, createUser, deleteUser, signIn } from "./helpers";

const slug = `e2e-tool-${RUN}`;
let adminUser: { id: string; email: string };

test.beforeAll(async () => {
  adminUser = await createUser("admin");
});
test.afterAll(async () => {
  await admin.from("external_tools").delete().eq("slug", slug);
  await admin.from("audit_log").delete().eq("actor_id", adminUser.id);
  await deleteUser(adminUser.id);
});

test("admin adds and disables an external tool (audited)", async ({ page }) => {
  await signIn(page, adminUser.email);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Tools" }).click();
  await expect(page.getByRole("heading", { name: "External tools" })).toBeVisible();
  await expect(page.getByText("Netlify Drop")).toBeVisible();

  const add = page.locator("form").last();
  await add.getByLabel("Name").fill(`E2E Tool ${RUN}`);
  await add.getByLabel("Slug").fill(slug);
  await add.getByLabel("Launch URL").fill("http://insecure.example.com");
  await add.getByLabel("Allowed submission domains").fill("*.example.app");
  await add.getByRole("button", { name: "Add tool" }).click();
  await expect(add.getByText("Must be an https:// URL")).toBeVisible();
  // What the admin typed survives the failed submit.
  await expect(add.getByLabel("Name")).toHaveValue(`E2E Tool ${RUN}`);
  await expect(add.getByLabel("Allowed submission domains")).toHaveValue("*.example.app");

  await add.getByLabel("Launch URL").fill("https://tool.example.com");
  await add.getByRole("button", { name: "Add tool" }).click();
  await expect(add.getByText("Tool added.")).toBeVisible();

  await page.reload();
  await page.getByText(`E2E Tool ${RUN}`).click();
  const edit = page.locator("details", { hasText: `E2E Tool ${RUN}` });
  await edit.getByLabel(/^Enabled/).uncheck();
  await edit.getByRole("button", { name: "Save tool" }).click();
  await expect(edit.getByText("Tool updated.")).toBeVisible();

  const { data: tool } = await admin.from("external_tools").select("enabled, submission_domains").eq("slug", slug).single();
  expect(tool).toEqual({ enabled: false, submission_domains: ["*.example.app"] });
  const { data: audit } = await admin.from("audit_log").select("action").eq("actor_id", adminUser.id).order("created_at");
  expect(audit?.map((a) => a.action)).toEqual(["tool.created", "tool.updated"]);
});
