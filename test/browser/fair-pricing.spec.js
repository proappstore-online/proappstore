const { test, expect } = require('@playwright/test');
const baseURL = process.env.PAS_FAIR_BASE_URL || 'http://127.0.0.1:4173';

test('proposed pricing explains status and updates the complete payment allocation', async ({ page }) => {
  await page.goto(baseURL + '/fair-pricing');
  await expect(page.getByText('Proposed model, not live billing.', { exact: true })).toBeVisible();
  await expect(page.locator('#fair-total')).toHaveText('$0.20');
  await page.locator('[name=referred]').uncheck();
  await expect(page.locator('#fair-rebate')).toHaveText('$0.0150');
  await expect(page.locator('#fair-total')).toHaveText('$0.19');
  await page.locator('[name=cap]').fill('0.10');
  await expect(page.locator('#fair-shortfall')).toHaveText('$0.0500');
  await expect(page.locator('#fair-total')).toHaveText('$0.09');
  await page.locator('[name=days]').fill('0');
  await expect(page.locator('#fair-total')).toHaveText('$0.00');
  await expect(page.locator('#fair-platform')).toHaveText('$0.0000');
  await page.locator('[name=days]').fill('32');
  await expect(page.locator('#fair-results')).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('Enter valid values');
});

test('calculator fits narrow and desktop screens in both themes', async ({ page }) => {
  await page.goto(baseURL + '/fair-pricing');
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#calculator').scrollIntoViewIfNeeded();
      await expect(page.locator('#fair-total')).toBeVisible();
    }
  }
});
