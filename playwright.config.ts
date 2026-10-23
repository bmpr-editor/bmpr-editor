import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4178',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.BMPR_TEST_BROWSER
      ? { executablePath: process.env.BMPR_TEST_BROWSER }
      : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.BMPR_TEST_PREVIEW
      ? 'npm run preview -- --port 4178 --strictPort'
      : 'npm run dev -- --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: !process.env.CI,
  },
});
