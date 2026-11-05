const { test, expect } = require('@playwright/test');
const fixture = require('../fixtures/contributors.json');
const SITE = 'http://127.0.0.1:4173/apps/synthetic-one/';
const API = 'https://api.proappstore.online/v1/storefront/apps/*/contributors';
test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
});
test('non-team promoter, safe text, hidden denominator, keyboard retry and mobile layout', async ({ page }) => {
  let fail = true;
  await page.route(API, route => fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: fixture }));
  await page.route('**/v1/storefront/apps/*/team', route => route.fulfill({ json: { members: [] } }));
  await page.goto(SITE);
  const section = page.locator('#contributors');
  await expect(section.getByRole('button')).toBeVisible();
  fail = false;
  await section.getByRole('button').focus(); await page.keyboard.press('Enter');
  await expect(section.locator('li')).toHaveCount(1);
  await expect(section).toContainText('20% share among all promoters');
  await expect(page.locator('#teamList')).not.toContainText('Synthetic promoter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const body = structuredClone(fixture); body.contributors[0].display_name = '<img src=x onerror=alert(1)>';
  await page.route(API, route => {
    expect(route.request().headers().cookie).toBeUndefined();
    return route.fulfill({ json: body });
  });
  await page.reload();
  await expect(section.locator('strong')).toHaveText(body.contributors[0].display_name);
  await expect(section.locator('img')).toHaveCount(0);
});
test('projection lifecycle clears names and restores only returned cards; missing/private and malformed fail closed', async ({ page }) => {
  let body = structuredClone(fixture), status = 200;
  await page.route(API, route => route.fulfill({ status, json: body }));
  await page.goto(SITE);
  await expect(page.locator('#contributorsList li')).toHaveCount(1);
  // Backend enforces consent/status. Consumer must display only the latest projection.
  for (const state of ['default off', 'profile opt-out', 'promotion opt-out', 'withdrawal', 're-enrollment', 'suspension', 'owner transfer', 'team removal']) {
    body = { ...fixture, contributors: [] }; await page.reload();
    await expect(page.locator('#contributorsList li'), state).toHaveCount(0);
    await expect(page.locator('#contributorsStatus')).toContainText('No public');
  }
  body = structuredClone(fixture); await page.reload();
  await expect(page.locator('#contributorsList li')).toHaveCount(1);
  status = 404; await page.reload();
  await expect(page.locator('#contributorsStatus')).toContainText('unavailable');
  await expect(page.locator('#contributorsList li')).toHaveCount(0);
  status = 200; body = { ...fixture, contributors: [{}] }; await page.reload();
  await expect(page.locator('#contributorsRetry')).toBeVisible();
  await expect(page.locator('#contributorsList li')).toHaveCount(0);
});
test('context change clears old cards while replacement is loading', async ({ page }) => {
  await page.route(API, route => route.request().url().includes('synthetic-two') ? route.fulfill({ status: 404 }) : route.fulfill({ json: fixture }));
  await page.goto(SITE);
  await expect(page.locator('#contributorsList li')).toHaveCount(1);
  await page.locator('#contributors').evaluate(el => el.setAttribute('data-app-id', 'synthetic-two'));
  await expect(page.locator('#contributorsStatus')).toContainText('unavailable');
  await expect(page.locator('#contributorsList li')).toHaveCount(0);
});

test('loading stays anonymous, late responses cannot restore an old app, and partial lists are rejected', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(API, async route => {
    if (route.request().url().includes('synthetic-one')) {
      await held;
      await route.fulfill({ json: fixture }).catch(() => {});
    } else await route.fulfill({ json: { ...fixture, app_id: 'synthetic-two', next: { after_id: 'unsupported' } } });
  });
  await page.goto(SITE);
  await expect(page.locator('#contributorsStatus')).toContainText('Loading');
  await expect(page.locator('#contributorsList li')).toHaveCount(0);
  await page.locator('#contributors').evaluate(el => el.setAttribute('data-app-id', 'synthetic-two'));
  await expect(page.locator('#contributorsRetry')).toBeVisible();
  release();
  await expect(page.locator('#contributorsList li')).toHaveCount(0);
});
