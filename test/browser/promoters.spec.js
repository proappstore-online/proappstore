const { test, expect } = require('@playwright/test');

// Synthetic fixture registry only (test/fixtures). No real apps, users, sign-ins or messages.
const UNAVAILABLE = 'http://127.0.0.1:4173';
const READY = 'http://127.0.0.1:4174';
const ENTRY = 'https://console.proappstore.online/#/promoter';

test.beforeEach(async ({ context }) => {
  // The pages reference Google Fonts and the live listing API; nothing external is needed or contacted.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const appButton = (page, id) => page.locator(`#promoApps button[data-app-id="${id}"]`);
const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Tab to the first CTA (bounded so a broken tab order fails instead of hanging). Safari/WebKit skips links
// on Tab unless the platform "tab to links" option is on, so fall back to Alt+Tab after a reload.
async function tabToFirstCta(page) {
  for (const key of ['Tab', 'Alt+Tab']) {
    await page.reload();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(key);
      if (await page.evaluate(() => document.activeElement?.classList.contains('promo-cta'))) return true;
    }
  }
  return false;
}

test.describe('promoter destination unavailable (staged state)', () => {
  test('both CTAs are inert disabled buttons with an honest status, and nothing links to the workspace', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/promoters`);
    await expect(page.getByRole('heading', { level: 1, name: 'Help grow apps you believe in' })).toBeVisible();
    const ctas = page.locator('.promo-cta');
    await expect(ctas).toHaveCount(4);
    for (const cta of await ctas.all()) {
      expect(await cta.evaluate((el) => el.tagName)).toBe('BUTTON');
      await expect(cta).toHaveAttribute('aria-disabled', 'true');
      await expect(cta).not.toHaveAttribute('href', /.*/);
    }
    await expect(page.locator('#promoStatus')).toContainText('Promoter sign-in is not open yet');
    expect(await page.locator('a[href*="/app/promoter"]').count()).toBe(0);

    const before = page.url();
    await page.getByRole('button', { name: 'Get started' }).first().click({ force: true });
    await page.getByRole('button', { name: 'Promoter sign in' }).first().click({ force: true });
    expect(page.url()).toBe(before);
  });

  test('no horizontal overflow at 360px on the page or the app entry point', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const url of ['/promoters', '/promoters?app=synthetic-one#choose', '/apps/synthetic-one/']) {
      await page.goto(UNAVAILABLE + url);
      expect(await noHorizontalOverflow(page), `${url} overflows at 360px`).toBe(true);
    }
  });

  test('deep link preselects the app and lands on the chooser; unknown or hostile ids select nothing', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/promoters?app=synthetic-two#choose`);
    await expect(appButton(page, 'synthetic-two')).toHaveAttribute('aria-pressed', 'true');
    await expect(appButton(page, 'synthetic-one')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#promoSelected')).toContainText('Selected app: Synthetic Two');
    await expect(page.locator('#choose')).toBeInViewport();

    for (const bad of ['nope', '..%2f..%2fetc', 'synthetic-one%26next%3Dhttps%3A%2F%2Fevil.example', 'SYNTHETIC-ONE', 'x'.repeat(80)]) {
      await page.goto(`${UNAVAILABLE}/promoters?app=${bad}#choose`);
      await expect(page.locator('#promoApps button[aria-pressed="true"]')).toHaveCount(0);
      await expect(page.locator('#promoNote')).toContainText('not in the current list');
    }
  });

  test('choosing an app records it in the URL and choosing it again clears it', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/promoters#choose`);
    await appButton(page, 'synthetic-one').click();
    await expect(appButton(page, 'synthetic-one')).toHaveAttribute('aria-pressed', 'true');
    expect(new URL(page.url()).searchParams.get('app')).toBe('synthetic-one');
    expect(new URL(page.url()).hash).toBe('#choose');
    await appButton(page, 'synthetic-two').click();
    await expect(appButton(page, 'synthetic-one')).toHaveAttribute('aria-pressed', 'false');
    expect(new URL(page.url()).searchParams.get('app')).toBe('synthetic-two');
    await appButton(page, 'synthetic-two').click();
    expect(new URL(page.url()).searchParams.has('app')).toBe(false);
  });

  test('keyboard only: CTAs are reachable but do nothing; an app can be chosen with Space and Enter', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/promoters`);
    const before = page.url();
    // Tab until the first CTA has focus (bounded so a broken tab order fails rather than hangs).
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.classList.contains('promo-cta'));
    }
    expect(reached, 'first CTA never received keyboard focus').toBe(true);
    expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true);
    await expect(page.locator('.promo-cta:focus')).toHaveText('Get started');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(page.url()).toBe(before);
    await page.keyboard.press('Tab');
    await expect(page.locator('.promo-cta:focus')).toHaveText('Promoter sign in');

    await appButton(page, 'synthetic-two').focus();
    await page.keyboard.press('Space');
    await expect(appButton(page, 'synthetic-two')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(appButton(page, 'synthetic-two')).toHaveAttribute('aria-pressed', 'false');
  });

  test('an app page leads to the promoter page with that app selected, and Back returns to the app page', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/apps/synthetic-one/`);
    await page.getByRole('link', { name: 'Help promote Synthetic One' }).click();
    await expect(page).toHaveURL(/\/promoters\?app=synthetic-one#choose$/);
    await expect(appButton(page, 'synthetic-one')).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/\/apps\/synthetic-one\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Synthetic One' })).toBeVisible();
  });

  test('the Promote link is in the shared header and footer navigation', async ({ page }) => {
    await page.goto(`${UNAVAILABLE}/`);
    expect(await page.locator('header nav a[href="/promoters"]').count()).toBe(1);
    await page.locator('footer a[href="/promoters"]').click();
    await expect(page).toHaveURL(`${UNAVAILABLE}/promoters`);
    await page.goBack();
    await expect(page).toHaveURL(`${UNAVAILABLE}/`);
  });
});

test.describe('promoter destination ready (synthetic Console destination)', () => {
  test('changing and clearing the selection isolates app context inside the hash', async ({ page }) => {
    await page.goto(`${READY}/promoters?app=synthetic-one`);
    const cta = page.locator('a.promo-cta').first();
    await expect(cta).toHaveAttribute('href', ENTRY + '?app=synthetic-one');
    await appButton(page, 'synthetic-two').click();
    await expect(cta).toHaveAttribute('href', ENTRY + '?app=synthetic-two');
    const destination = new URL(await cta.getAttribute('href'));
    expect(destination.search).toBe('');
    expect(destination.hash).toBe('#/promoter?app=synthetic-two');
    await appButton(page, 'synthetic-two').click();
    await expect(cta).toHaveAttribute('href', ENTRY);
  });

  test('CTAs are real links that carry only a validated app id, and navigate there and back', async ({ page }) => {
    await page.route('https://console.proappstore.online/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>stub</title>stub console' }));
    await page.goto(`${READY}/promoters`);
    const ctas = page.locator('a.promo-cta');
    await expect(ctas).toHaveCount(4);
    await expect(ctas.first()).toHaveAttribute('href', ENTRY);
    expect(await page.locator('.promo-cta[aria-disabled]').count()).toBe(0);

    await appButton(page, 'synthetic-two').click();
    await expect(ctas.first()).toHaveAttribute('href', ENTRY + '?app=synthetic-two');
    await expect(ctas.last()).toHaveAttribute('href', ENTRY + '?app=synthetic-two');

    await page.getByRole('link', { name: 'Get started' }).first().click();
    await expect(page).toHaveURL(ENTRY + '?app=synthetic-two');
    await page.goBack();
    await expect(page).toHaveURL(/\/promoters\?app=synthetic-two/);
    await expect(appButton(page, 'synthetic-two')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a hostile app parameter never reaches the destination link', async ({ page }) => {
    for (const bad of ['synthetic-one%26next%3Dhttps%3A%2F%2Fevil.example', '%2F%2Fevil.example', 'javascript%3Aalert(1)', 'unknown']) {
      await page.goto(`${READY}/promoters?app=${bad}`);
      for (const href of await page.locator('a.promo-cta').evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
        expect(href).toBe(ENTRY);
      }
    }
  });

  test('keyboard activation of the Get started link follows the destination', async ({ page, browserName }) => {
    await page.route('https://console.proappstore.online/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>stub</title>stub console' }));
    await page.goto(`${READY}/promoters?app=synthetic-one`);
    if (!(await tabToFirstCta(page))) {
      // Some WebKit builds (observed: Playwright WebKit on Windows) never Tab onto links; that is a browser
      // preference, not page markup. Chromium must still reach the link by Tab. Elsewhere, prove the link is
      // focusable and keyboard-activatable by focusing it directly.
      expect(browserName, 'first CTA never received keyboard focus').toBe('webkit');
      test.info().annotations.push({ type: 'webkit-tab-to-links', description: 'Tab did not land on links in this WebKit build; focused programmatically' });
      await page.locator('a.promo-cta').first().focus();
      expect(await page.evaluate(() => document.activeElement?.classList.contains('promo-cta'))).toBe(true);
    }
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(ENTRY + '?app=synthetic-one');
  });
});
