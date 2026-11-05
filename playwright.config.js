const os = require('node:os');
const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

// Mobile Chromium + mobile WebKit against the storefront built from the synthetic
// fixture registry (test/fixtures). Two sites: promoter destination unavailable
// (the committed staged state) and ready (synthetic same-site destination).
module.exports = defineConfig({
  testDir: 'test/browser',
  testMatch: '*.spec.js',
  // Outside the repo: deploy.yml publishes the working directory.
  outputDir: path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'pas-playwright-results'),
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    { command: 'node test/browser/serve.cjs unavailable 4173', url: 'http://127.0.0.1:4173/promoters', reuseExistingServer: false, timeout: 60000 },
    { command: 'node test/browser/serve.cjs ready 4174', url: 'http://127.0.0.1:4174/promoters', reuseExistingServer: false, timeout: 60000 },
  ],
});
