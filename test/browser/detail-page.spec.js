const { test, expect } = require('@playwright/test');
const SITE = 'http://127.0.0.1:4173';

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
});

test('landing referral reaches all three canonical launch links and no unrelated links', async ({ page }) => {
  await page.goto(SITE + '/apps/synthetic-one/?ref=testcode');
  const links = page.locator('a[data-launch-link]');
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('href', 'https://synthetic-one.proappstore.online/?ref=testcode');
  }
  for (const href of await page.locator('a:not([data-launch-link])').evaluateAll(els => els.map(el => el.href))) {
    expect(new URL(href).searchParams.has('ref')).toBe(false);
  }
  await page.goto(SITE + '/apps/synthetic-two/');
  for (const link of await page.locator('[data-launch-link]').all()) {
    await expect(link).toHaveAttribute('href', 'https://synthetic-two.proappstore.online');
  }
});

test('absent, duplicate or hostile referral leaves launch hrefs intact', async ({ page }) => {
  for (const search of ['', '?ref=', '?ref=has+space', '?ref=%3Cscript%3E', '?ref=a%26b', '?ref=a%22b', '?ref=' + 'x'.repeat(65), '?ref=one&ref=two']) {
    await page.goto(SITE + '/apps/synthetic-one/' + search);
    for (const link of await page.locator('[data-launch-link]').all()) {
      await expect(link).toHaveAttribute('href', 'https://synthetic-one.proappstore.online');
    }
  }
});

test('query/hash survive propagation and marked hostile or cross-app targets stay unchanged', async ({ page }) => {
  await page.route(SITE + '/apps/synthetic-one/**', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replaceAll('href="https://synthetic-one.proappstore.online" data-launch-link',
      'href="https://synthetic-one.proappstore.online/path?mode=demo#section" data-launch-link');
    body = body.replace('</main>', '<a data-launch-link href="https://evil.example/">hostile</a><a data-launch-link href="https://synthetic-two.proappstore.online/">other app</a><a href="https://x.com/synthetic">social</a></main>');
    await route.fulfill({ response, body });
  });
  await page.goto(SITE + '/apps/synthetic-one/?ref=testcode');
  await expect(page.getByRole('link', { name: 'Open app', exact: true })).toHaveAttribute('href',
    'https://synthetic-one.proappstore.online/path?mode=demo&ref=testcode#section');
  await expect(page.getByRole('link', { name: 'hostile', exact: true })).toHaveAttribute('href', 'https://evil.example/');
  await expect(page.getByRole('link', { name: 'other app', exact: true })).toHaveAttribute('href', 'https://synthetic-two.proappstore.online/');
  await expect(page.getByRole('link', { name: 'social', exact: true })).toHaveAttribute('href', 'https://x.com/synthetic');
});
