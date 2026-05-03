import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const TEST_PORT = Number(process.env.E2E_PORT ?? "18936");
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Resolve a chromium binary on this system. Playwright's bundled browsers
// are not used here because this Nix-based environment provides chromium
// via the system package set instead of via `npx playwright install`.
function resolveChromiumPath(): string {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = ["chromium", "chromium-browser", "google-chrome"];
  for (const candidate of candidates) {
    try {
      const resolved = execSync(`command -v ${candidate}`, {
        encoding: "utf8",
      }).trim();
      if (resolved && existsSync(resolved)) return resolved;
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    "Could not find a chromium binary. Install one with the package " +
      "manager (e.g. `chromium`) or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
  );
}

const CHROMIUM_PATH = resolveChromiumPath();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    cwd: ".",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(TEST_PORT),
      BASE_PATH: "/",
      NODE_ENV: "development",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
});
