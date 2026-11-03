import { defineConfig, devices } from "@playwright/test";

/**
 * Two suites:
 *  - tests/e2e       signed-out flows; runs anywhere with placeholder Supabase values.
 *  - tests/e2e-live  real sign-in + Studio flows against the Supabase project in
 *                    .env.local (`npm run test:e2e:live`). Creates throwaway users
 *                    and content and deletes them afterwards.
 */
const LIVE = process.env.E2E_LIVE === "1";
if (LIVE) process.loadEnvFile?.(".env.local");

const PORT = Number(process.env.E2E_PORT ?? (LIVE ? 3101 : 3100));

const env: Record<string, string> = LIVE
  ? {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
    }
  : {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-placeholder",
      SUPABASE_SECRET_KEY: "e2e-placeholder",
    };

export default defineConfig({
  testDir: LIVE ? "tests/e2e-live" : "tests/e2e",
  fullyParallel: !LIVE,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: LIVE ? 90_000 : 30_000,
  globalTeardown: LIVE ? "./tests/e2e-live/global-teardown.ts" : undefined,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: LIVE
    ? [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "mobile", use: { ...devices["Pixel 7"] } },
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
      ],
  webServer: {
    // Separate build dir per suite so the two never serve each other's build.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { ...env, NEXT_DIST_DIR: LIVE ? ".next-e2e-live" : ".next-e2e" },
  },
});
