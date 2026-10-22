import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/pp8',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.PP8_ANGULAR_URL ?? 'http://localhost:4200',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: 'npm.cmd start -- --configuration local --host 127.0.0.1 --port 4200',
    url: 'http://localhost:4200/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
