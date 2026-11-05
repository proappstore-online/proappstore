const { test, expect } = require('@playwright/test');

// Synthetic fixtures only. The platform API is replaced by an in-test double that follows
// docs/public-team-projection.md (platform#542); no real request ever reaches api.proappstore.online,
// and no real enquiry is created. The double also keeps an "owner inbox" so a submission can be
// followed into review. Real CORS was checked separately against the live API (see the commit).
const SITE = 'http://127.0.0.1:4173';
const APP = 'synthetic-one';
const API = 'https://api.proappstore.online';
const CORS = { 'access-control-allow-origin': SITE, 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET,POST,OPTIONS', vary: 'Origin' };

const GOOD = { name: 'Sam Lee', email: 'sam@example.com', message: 'I would like to help with translations.' };

/** A minimal platform double. `behaviour` can be changed mid-test. */
async function installApi(page, behaviour = {}) {
  const api = {
    team: { status: 200, body: { members: [] } },
    teamDelayMs: 0,
    join: { status: 201, body: { ok: true }, headers: {} },
    teamCalls: 0,
    joinCalls: [],
    inbox: [],
    ...behaviour,
  };
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== API) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === `/v1/storefront/apps/${APP}/team` && req.method() === 'GET') {
      api.teamCalls++;
      if (api.team.status === 0) return route.abort('failed');
      if (api.teamDelayMs) await new Promise((r) => setTimeout(r, api.teamDelayMs));
      return route.fulfill({ status: api.team.status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(api.team.body) });
    }
    if (url.pathname === `/v1/storefront/apps/${APP}/enquiries/team-join` && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      api.joinCalls.push({ body, headers: req.headers() });
      if (api.join.status === 0) return route.abort('failed');
      if (api.join.status === 201) api.inbox.push({ type: 'team_join', status: 'new', ...body });
      return route.fulfill({ status: api.join.status, headers: { ...CORS, 'content-type': 'application/json', ...api.join.headers }, body: JSON.stringify(api.join.body) });
    }
    return route.fulfill({ status: 404, headers: CORS, body: 'not found' });
  });
  return api;
}

const open = async (page, api) => { await page.goto(`${SITE}/apps/${APP}/`); return api; };
const fill = async (page, v = GOOD) => {
  await page.locator('#teamName').fill(v.name);
  await page.locator('#teamEmail').fill(v.email);
  await page.locator('#teamMessage').fill(v.message);
};
const openForm = async (page) => {
  await expect(page.locator('#teamJoinToggle')).toBeVisible();
  await page.locator('#teamJoinToggle').click();
  await expect(page.locator('#teamJoinForm')).toBeVisible();
};

test.describe('team list states', () => {
  test('loading, then members rendered as text with a creator badge and label', async ({ page }) => {
    const api = await installApi(page, { teamDelayMs: 600, team: { status: 200, body: { members: [
      { display_name: 'Ada L.', label: 'Maintainer', is_creator: true },
      { display_name: 'Bo', label: '', is_creator: false },
    ] } } });
    await open(page, api);
    await expect(page.locator('#teamStatus')).toHaveText('Loading the team…');
    await expect(page.locator('#team')).toHaveAttribute('aria-busy', 'true');
    const items = page.locator('#teamList .team-member');
    await expect(items).toHaveCount(2);
    await expect(page.locator('#team')).toHaveAttribute('aria-busy', 'false');
    await expect(items.nth(0)).toContainText('Ada L.');
    await expect(items.nth(0).locator('.team-badge')).toHaveText('Creator');
    await expect(items.nth(0).locator('.team-label')).toHaveText('Maintainer');
    await expect(items.nth(1)).toContainText('Bo');
    await expect(items.nth(1).locator('.team-badge, .team-label')).toHaveCount(0);
    await expect(items.nth(0).locator('.team-avatar')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#teamStatus')).toBeHidden();
    await expect(page.locator('#teamJoinToggle')).toBeVisible();
    // Only the team call happened; nothing was posted by viewing the page.
    expect(api.teamCalls).toBe(1);
    expect(api.joinCalls).toHaveLength(0);
  });

  test('hostile names are shown as inert text and no markup, link or script is created', async ({ page }) => {
    const evil = '<img src=x onerror="window.__xss=1">';
    const api = await installApi(page, { team: { status: 200, body: { members: [
      { display_name: evil, label: '<script>window.__xss=2</script>', is_creator: false, user_id: 'gh:1', email: 'leak@example.com', avatar: 'javascript:alert(1)' },
    ] } } });
    await open(page, api);
    const item = page.locator('#teamList .team-member');
    await expect(item).toHaveCount(1);
    await expect(item.locator('.team-name')).toHaveText(evil);
    await expect(item.locator('.team-label')).toHaveText('<script>window.__xss=2</script>');
    expect(await item.locator('img, script, a, iframe').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('#team').innerHTML()).not.toContain('leak@example.com');
  });

  test('an empty list says so and still offers the request', async ({ page }) => {
    await open(page, await installApi(page));
    await expect(page.locator('#teamStatus')).toHaveText('No team members have chosen to be listed yet.');
    await expect(page.locator('#teamList')).toBeHidden();
    await expect(page.locator('#teamJoinToggle')).toBeVisible();
  });

  test('a private or delisted app (404) shows a neutral note and offers no form', async ({ page }) => {
    await open(page, await installApi(page, { team: { status: 404, body: 'not found' } }));
    await expect(page.locator('#teamStatus')).toHaveText("Team information isn't available for this app.");
    await expect(page.locator('#teamJoin')).toBeHidden();
    await expect(page.locator('#teamList')).toBeHidden();
    await expect(page.locator('#teamRetry')).toBeHidden();
  });

  test('an unavailable platform shows a retry that recovers', async ({ page }) => {
    const api = await installApi(page, { team: { status: 503, body: { error: 'down' } } });
    await open(page, api);
    await expect(page.locator('#teamStatus')).toHaveText("The team list can't be loaded right now.");
    await expect(page.locator('#teamJoin')).toBeHidden();
    api.team = { status: 200, body: { members: [{ display_name: 'Ada L.', label: '', is_creator: true }] } };
    await page.locator('#teamRetry').click();
    await expect(page.locator('#teamList .team-member')).toHaveCount(1);
    await expect(page.locator('#teamRetry')).toBeHidden();
    await expect(page.locator('#teamJoinToggle')).toBeVisible();
    expect(api.teamCalls).toBe(2);
  });

  test('a network failure and a malformed answer are both "unavailable", never a crash or a false roster', async ({ page }) => {
    for (const team of [{ status: 0, body: null }, { status: 200, body: { members: 'nope' } }, { status: 200, body: ['not', 'an', 'object'] }]) {
      await installApi(page, { team });
      await page.goto(`${SITE}/apps/${APP}/`);
      await expect(page.locator('#teamStatus')).toHaveText("The team list can't be loaded right now.");
      await expect(page.locator('#teamList .team-member')).toHaveCount(0);
      await page.context().unrouteAll();
    }
  });

  test('without JavaScript the page claims nothing and the form is unreachable', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${SITE}/apps/${APP}/`);
    await expect(page.locator('#team noscript')).toHaveCount(1);
    await expect(page.locator('#teamList')).toBeHidden();
    await expect(page.locator('#teamJoin')).toBeHidden();
    await context.close();
  });
});

test.describe('request to join', () => {
  test('keyboard: Tab to the button, Enter opens the form, focus moves to the first field', async ({ page, browserName }) => {
    await open(page, await installApi(page));
    await expect(page.locator('#teamJoinToggle')).toBeVisible();
    // WebKit builds that skip links on Tab still reach buttons.
    await page.locator('#teamJoinToggle').focus();
    expect(await page.evaluate(() => document.activeElement.id)).toBe('teamJoinToggle');
    expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#teamJoinToggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('teamName');
    await page.keyboard.type(GOOD.name);
    await page.keyboard.press('Tab');
    await page.keyboard.type(GOOD.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(GOOD.message);
    expect(await page.locator('#teamName').inputValue()).toBe(GOOD.name);
    expect(await page.locator('#teamMessage').inputValue()).toBe(GOOD.message);
    void browserName;
  });

  test('empty and invalid input is explained inline, focus goes to the first problem, and nothing is sent', async ({ page }) => {
    const api = await installApi(page);
    await open(page, api);
    await openForm(page);
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamNameErr')).toHaveText('Enter your name.');
    await expect(page.locator('#teamEmailErr')).toBeVisible();
    await expect(page.locator('#teamMessageErr')).toBeVisible();
    await expect(page.locator('#teamName')).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('teamName');
    await expect(page.locator('#teamFormStatus')).toHaveText('Please fix the highlighted fields.');

    await fill(page, { name: 'Sam <b>', email: 'not-an-email', message: 'hi <script>x</script>' });
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamNameErr')).toHaveText('Use plain text in your name.');
    await expect(page.locator('#teamEmailErr')).toHaveText('Enter a valid email address.');
    await expect(page.locator('#teamMessageErr')).toContainText('no HTML');
    expect(api.joinCalls).toHaveLength(0);

    // Correcting the fields clears the errors and sends.
    await fill(page);
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamSent')).toBeVisible();
    for (const id of ['#teamNameErr', '#teamEmailErr', '#teamMessageErr']) await expect(page.locator(id)).toBeHidden();
  });

  test('a valid request is posted once as typed JSON, confirmed honestly, and lands in the owner inbox as team_join', async ({ page }) => {
    const api = await installApi(page);
    await open(page, api);
    await openForm(page);
    await fill(page);
    // A double click must not send twice.
    await page.locator('#teamSubmit').dblclick();
    await expect(page.locator('#teamSent')).toBeVisible();
    expect(api.joinCalls).toHaveLength(1);
    const call = api.joinCalls[0];
    expect(call.body).toEqual(GOOD);                       // no honeypot field, nothing extra
    expect(call.headers['content-type']).toContain('application/json');
    expect(call.headers.cookie).toBeUndefined();           // credentials omitted
    expect(call.headers.authorization).toBeUndefined();

    // Confirmation: focus moves to it, the form is gone, and it makes no delivery claim.
    expect(await page.evaluate(() => document.activeElement.id)).toBe('teamSent');
    await expect(page.locator('#teamJoinForm')).toBeHidden();
    const text = await page.locator('#teamSent').innerText();
    expect(text).toContain('does not make you a member');
    expect(text).not.toMatch(/we (have )?(emailed|notified)|notification|push|has been notified/i);
    await expect(page.locator('#teamJoinToggle')).toBeDisabled();

    // Followed into review: the (synthetic) owner inbox has exactly one new team-join enquiry.
    expect(api.inbox).toEqual([{ type: 'team_join', status: 'new', ...GOOD }]);
  });

  test('the honeypot is invisible, unreachable by keyboard, and a filled one is forwarded for the server to discard', async ({ page }) => {
    const api = await installApi(page);
    await open(page, api);
    await openForm(page);
    const box = await page.locator('#teamWebsite').boundingBox();
    expect(box === null || box.x < 0, 'honeypot should sit off-screen').toBe(true);
    await expect(page.locator('.team-hp')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#teamWebsite')).toHaveAttribute('tabindex', '-1');
    await fill(page);
    await page.locator('#teamWebsite').evaluate((el) => { el.value = 'http://spam.example'; });
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamSent')).toBeVisible();
    expect(api.joinCalls[0].body.website).toBe('http://spam.example');
  });

  test('rate limited: says when to retry, keeps what was typed, and a later retry succeeds', async ({ page }) => {
    const api = await installApi(page, { join: { status: 429, body: { ok: false, error: 'rate-limited' }, headers: { 'retry-after': '3600' } } });
    await open(page, api);
    await openForm(page);
    await fill(page);
    await page.locator('#teamSubmit').click();
    // The real API does not expose Retry-After to cross-origin pages, and this double does not either.
    await expect(page.locator('#teamFormStatus')).toContainText('in about an hour');
    await expect(page.locator('#teamSubmit')).toBeEnabled();
    expect(await page.locator('#teamMessage').inputValue()).toBe(GOOD.message);
    await expect(page.locator('#teamSent')).toBeHidden();
    api.join = { status: 201, body: { ok: true }, headers: {} };
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamSent')).toBeVisible();
    expect(api.joinCalls).toHaveLength(2);
  });

  test('server-side rejection shows the reason as text and keeps the form', async ({ page }) => {
    const api = await installApi(page, { join: { status: 400, body: { ok: false, error: 'invalid', detail: '<b>markup</b> is not allowed' } } });
    await open(page, api);
    await openForm(page);
    await fill(page);
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamFormStatus')).toContainText('<b>markup</b> is not allowed');
    expect(await page.locator('#teamFormStatus b').count()).toBe(0);
    expect(await page.locator('#teamName').inputValue()).toBe(GOOD.name);
    await expect(page.locator('#teamSubmit')).toBeEnabled();
  });

  test('an app that stops taking requests (404) is explained and cannot be resubmitted', async ({ page }) => {
    const api = await installApi(page, { join: { status: 404, body: 'not found' } });
    await open(page, api);
    await openForm(page);
    await fill(page);
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamFormStatus')).toHaveText("This app isn't taking team requests right now.");
    await expect(page.locator('#teamSubmit')).toBeDisabled();
    expect(api.inbox).toHaveLength(0);
  });

  test('a dropped connection or server error keeps the message and allows a retry', async ({ page }) => {
    for (const join of [{ status: 0, body: null }, { status: 500, body: { error: 'boom' } }]) {
      const api = await installApi(page, { join });
      await page.goto(`${SITE}/apps/${APP}/`);
      await openForm(page);
      await fill(page);
      await page.locator('#teamSubmit').click();
      await expect(page.locator('#teamFormStatus')).toContainText('still here');
      await expect(page.locator('#teamSubmit')).toBeEnabled();
      expect(await page.locator('#teamMessage').inputValue()).toBe(GOOD.message);
      expect(api.inbox).toHaveLength(0);
      await page.context().unrouteAll();
    }
  });

  test('a repeat request (server answers 201 and stores nothing) looks the same to the visitor', async ({ page }) => {
    const api = await installApi(page, { join: { status: 201, body: { ok: true } } }); // duplicate: no id
    await open(page, api);
    await openForm(page);
    await fill(page);
    await page.locator('#teamSubmit').click();
    await expect(page.locator('#teamSent')).toBeVisible();
    await expect(page.locator('#teamSentText')).toContainText('does not make you a member');
  });
});

test.describe('layout', () => {
  test('no horizontal overflow at 360px with long names and the form open', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const api = await installApi(page, { team: { status: 200, body: { members: [
      { display_name: 'W'.repeat(60), label: 'L'.repeat(40), is_creator: true },
      { display_name: 'Averyveryveryverylongsinglewordnamewithoutanybreaks', label: '', is_creator: false },
    ] } } });
    await open(page, api);
    await expect(page.locator('#teamList .team-member')).toHaveCount(2);
    await openForm(page);
    await fill(page, { name: GOOD.name, email: GOOD.email, message: 'm'.repeat(400) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const id of ['#teamName', '#teamEmail', '#teamMessage', '#teamSubmit', '#teamJoinToggle']) {
      const box = await page.locator(id).boundingBox();
      expect(box.height, `${id} touch target`).toBeGreaterThanOrEqual(40);
      expect(box.x + box.width, `${id} inside viewport`).toBeLessThanOrEqual(360);
    }
  });
});
