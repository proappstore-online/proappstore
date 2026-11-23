const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SITE = 'http://127.0.0.1:4173';

// Every page the candidate serves, under the production CSP (serve.cjs sends it):
// an inline script, handler or style the policy blocks is a silent breakage (issue #24).
const out = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'pas-browser-site', 'unavailable');
function pages() {
  const top = fs.readdirSync(out).filter(f => f.endsWith('.html')).map(f => '/' + f.replace(/\.html$/, '').replace(/^index$/, ''));
  const apps = fs.readdirSync(path.join(out, 'apps')).map(id => `/apps/${id}/`);
  return [...top, ...apps];
}

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
});

test('no page violates the storefront CSP', async ({ page, browserName }) => {
  // WebKit reports its own native <select> rendering as a style-src-attr violation.
  test.skip(browserName === 'webkit', 'Chromium only: WebKit reports UA-internal styles');
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', e => {
      // proappstore.online is 'self' in production; only this test server's origin differs.
      if (!/^https:\/\/proappstore\.online(:443)?\//.test(e.blockedURI)) window.__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample}`);
    });
  });
  const found = [];
  for (const p of pages()) {
    await page.goto(SITE + p);
    await page.waitForLoadState('load');
    for (const v of await page.evaluate(() => window.__violations)) found.push(`${p}: ${v}`);
  }
  expect(found).toEqual([]);
});
