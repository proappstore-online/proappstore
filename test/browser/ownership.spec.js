const { test, expect } = require('@playwright/test');
const baseURL = process.env.PAS_FAIR_BASE_URL || 'http://127.0.0.1:4173';
test('growth calculator distinguishes sponsorship, payout and runway', async ({ page }) => {
  await page.goto(baseURL + '/dating-economics');
  await expect(page.locator('#growth-gap')).toHaveText('$40.00');
  await page.locator('[name=mau]').fill('10000');
  await page.locator('[name=sponsor]').fill('100');
  await page.locator('[name=reserve]').fill('1800');
  await expect(page.locator('#growth-gap')).toHaveText('$300.00');
  await expect(page.locator('#growth-runway')).toContainText('6.0 months');
  await expect(page.locator('#growth-platform')).toHaveText('$10.00');
  await page.locator('[name=payPercent]').fill('100');
  await expect(page.locator('#growth-gap')).toHaveText('$0.00');
  await expect(page.locator('#growth-runway')).toContainText('No reserve draw');
  await page.locator('[name=payPercent]').fill('101');
  await expect(page.locator('#growth-results')).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('valid values');
});
test('guides are linked, readable on narrow screens, and explicitly proposals', async ({ page }, testInfo) => {
  await page.goto(baseURL + '/fair-pricing');
  await page.getByRole('link', { name: 'Dating: launch to 1 million users', exact: true }).click();
  await expect(page).toHaveURL(/dating-economics$/);
  for (const route of ['dating-economics', 'ownership']) {
    await page.goto(baseURL + '/' + route);
    await expect(page.locator('.fair-status')).toBeVisible();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (process.env.PAS_GUIDE_CAPTURE && ((width === 320 && theme === 'dark') || (width === 1280 && theme === 'light'))) {
          await page.locator(route === 'ownership' ? '#buyouts' : '#funding').scrollIntoViewIfNeeded();
          await page.screenshot({ path: testInfo.outputPath(`${route}-${width}-${theme}.png`) });
        }
      }
    }
  }
  await expect(page.locator('#buyouts')).toContainText('company receives $0');
  await expect(page.locator('#buyouts')).toContainText('company receives $50,000');
});
