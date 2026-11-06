const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDestination } = require('../promoters.js');

const ROOT = path.resolve(__dirname, '..');
const BUILD_JS = path.join(ROOT, 'build.js');
const FIXTURE_REGISTRY = path.join(__dirname, 'fixtures', 'browser-registry.json');
const READY_DESTINATION = path.join(__dirname, 'fixtures', 'promoter-destination-ready.json');

function build({ registry = FIXTURE_REGISTRY, destination } = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-promoters-test-'));
  const env = { ...process.env, REGISTRY_PATH: registry, OUT_DIR: out };
  if (destination) env.PROMOTER_DESTINATION_PATH = destination;
  else env.PROMOTER_DESTINATION_PATH = path.join(ROOT, 'test/fixtures/promoter-destination-unavailable.json');
  try {
    execFileSync(process.execPath, [BUILD_JS], { env, cwd: ROOT, stdio: 'pipe' });
    return { out, failed: false, stderr: '' };
  } catch (err) {
    return { out, failed: true, stderr: String(err.stderr || err.message) };
  }
}
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const visibleText = (html) => html
  .replace(/<head>[\s\S]*?<\/head>/, '')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');
const writeTmpJson = (value) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pas-promoters-dest-')), 'dest.json');
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};
const cleanup = (...dirs) => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));

test('/promoters is a separate page with the headline, canonical, social and description metadata', () => {
  const { out, failed, stderr } = build();
  try {
    assert.equal(failed, false, stderr);
    const html = read(out, 'promoters.html');
    assert.match(html, /<h1 id="promo-title">Help grow apps you believe in<\/h1>/);
    assert.match(html, /<title>Help grow apps you believe in/);
    assert.match(html, /<link rel="canonical" href="https:\/\/proappstore\.online\/promoters" \/>/);
    assert.match(html, /<meta property="og:url" content="https:\/\/proappstore\.online\/promoters" \/>/);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) assert.ok(html.includes(`property="${tag}"`), tag);
    for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(html.includes(`name="${tag}"`), tag);
    assert.match(html, /<meta name="description" content="[^"]{60,}"/);
    assert.match(html, /id="choose"/);
    assert.match(read(out, 'sitemap.xml'), /<loc>https:\/\/proappstore\.online\/promoters<\/loc>/);
  } finally { cleanup(out); }
});

test('the page explains contributions, activities, the confirmed-user rule and the share denominator', () => {
  const { out } = build();
  try {
    const text = visibleText(read(out, 'promoters.html'));
    assert.match(text, /recognized\s+contributions alongside coding/);
    for (const activity of [/friend/, /tutorial/, /communities/, /QR/]) assert.match(text, activity);
    assert.match(text, /does not send outreach for you and does not import your contacts/);
    assert.match(text, /Clicks and QR scans are not users/);
    assert.match(text, /Promotion \/ Marketing/);
    assert.match(text, /divided by all promoters' confirmed referred users for the same app and the same period/);
    assert.match(text, /not a share of all the app's users/);
  } finally { cleanup(out); }
});

test('the page makes no cash, income-rate, salary or guaranteed-reward claims in either CTA state', () => {
  const banned = /\bcash\b|per referral|per-referral|salary|salaries|guaranteed|\bcommission\b|\bpayouts?\b|\bearn(s|ed|ings)?\b|\$\s?\d|€\s?\d|£\s?\d/i;
  for (const destination of [undefined, READY_DESTINATION]) {
    const { out } = build({ destination });
    try {
      const text = visibleText(read(out, 'promoters.html'));
      assert.doesNotMatch(text, banned, text.match(banned) && `banned claim: ${text.match(banned)[0]}`);
      assert.match(text, /not a job/);
    } finally { cleanup(out); }
  }
  assert.doesNotMatch(visibleText(read(ROOT, 'templates/promoters.html')), banned);
});

test('unavailable state: both CTAs are inert aria-disabled buttons with no link to the promoter workspace', () => {
  const { out } = build();
  try {
    const html = read(out, 'promoters.html');
    assert.equal((html.match(/<button type="button" class="[^"]*promo-cta"[^>]*aria-disabled="true"/g) || []).length, 4);
    assert.ok(html.includes('>Get started</button>') && html.includes('>Promoter sign in</button>'));
    assert.doesNotMatch(html, /<a [^>]*promo-cta/);
    assert.doesNotMatch(html, /data-destination/);
    assert.doesNotMatch(html, /href="[^"]*\/app\/promoter/);
    assert.match(html, /id="promoStatus" role="status">Promoter sign-in is not open yet/);
    assert.equal((html.match(/aria-describedby="promoStatus"/g) || []).length, 4);
  } finally { cleanup(out); }
});

test('ready state (synthetic fixture): CTAs become real Console links and nothing is aria-disabled', () => {
  const { out, failed, stderr } = build({ destination: READY_DESTINATION });
  try {
    assert.equal(failed, false, stderr);
    const html = read(out, 'promoters.html');
    assert.equal((html.match(/<a class="btn-(?:primary|outline) promo-cta" href="https:\/\/console\.proappstore\.online\/#\/promoter" data-destination="https:\/\/console\.proappstore\.online\/#\/promoter">/g) || []).length, 4);
    assert.doesNotMatch(html, /aria-disabled/);
    assert.doesNotMatch(html, /Promoter sign-in is not open yet/);
  } finally { cleanup(out); }
});

test('a ready destination that is missing, off-site or not https fails the build instead of shipping a bad link', () => {
  const cases = [
    { ready: true, url: null },
    { ready: true, url: 'https://evil.example/app/promoter' },
    { ready: true, url: 'javascript:alert(1)' },
    { ready: true, url: '//evil.example/x' },
    { ready: true, url: 'http://promoters.proappstore.online/' },
    { ready: 'yes', url: '/app/promoter' },
  ];
  for (const c of cases) {
    const { out, failed, stderr } = build({ destination: writeTmpJson(c) });
    try {
      assert.equal(failed, true, `build accepted ${JSON.stringify(c)}`);
      assert.match(stderr, /promoter-destination\.json/);
      assert.ok(!fs.existsSync(path.join(out, 'promoters.html')), 'bad destination still wrote a page');
    } finally { cleanup(out); }
  }
});

test('the committed destination has a valid activation flag and Console URL', () => {
  const data = JSON.parse(read(ROOT, 'data/promoter-destination.json'));
  assert.equal(typeof data.ready, 'boolean');
  if (!data.ready) assert.equal(data.url, null);
  else assert.equal(buildDestination(data.url), data.url);
});

test('promoters.js is loaded with a matching SRI hash; the page has no inline script beyond the theme bootstrap and no inline style', () => {
  const { out } = build();
  try {
    const html = read(out, 'promoters.html');
    const expected = 'sha256-' + crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'promoters.js'))).digest('base64');
    assert.ok(html.includes(`<script src="/promoters.js" integrity="${expected}"></script>`), 'SRI mismatch');
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, 'unreplaced template token');
    assert.equal((html.match(/<script>[\s\S]*?<\/script>/g) || []).length, 1);
    assert.doesNotMatch(html.replace(/<head>[\s\S]*?<\/head>/, ''), /\sstyle="|\son\w+="/);
    assert.doesNotMatch(html, /http-equiv="Content-Security-Policy"/i);
    // The bootstrap must still match the hash that _headers allows.
    const bootstrap = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
    const hash = 'sha256-' + crypto.createHash('sha256').update(bootstrap).digest('base64');
    assert.ok(read(out, '_headers').includes(`'${hash}'`), 'inline bootstrap hash is not in script-src');
  } finally { cleanup(out); }
});

test('app names from the registry are escaped on the promoters page', () => {
  const registry = writeTmpJson({ apps: [{
    id: 'xss-app', name: '"><script>alert(1)</script>', category: '"><img src=x onerror=alert(1)>',
    description: 'ok', appUrl: 'https://xss-app.proappstore.online', repo: 'proappstore-online/xss-app', developer: 'ProAppStore',
  }] });
  const { out, failed, stderr } = build({ registry });
  try {
    assert.equal(failed, false, stderr);
    const html = read(out, 'promoters.html');
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.ok(html.includes('data-app-name="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  } finally { cleanup(out); }
});

test('the app list is generated from the registry (eligible-app context), not hard-coded', () => {
  const { out } = build();
  try {
    const ids = JSON.parse(fs.readFileSync(FIXTURE_REGISTRY, 'utf8')).apps.map((a) => a.id);
    const html = read(out, 'promoters.html');
    assert.deepEqual([...html.matchAll(/data-app-id="([^"]+)"/g)].map((m) => m[1]), ids);
    for (const id of ids) assert.ok(html.includes(`href="/apps/${id}/"`));
  } finally { cleanup(out); }
  const template = read(ROOT, 'templates/promoters.html');
  assert.doesNotMatch(template, /data-app-id|\/apps\//, 'template hard-codes an app entry');
  const real = JSON.parse(read(ROOT, 'registry.json')).apps.map((a) => a.id);
  for (const id of real) {
    assert.doesNotMatch(template, new RegExp(`(?:/|=")${id}(?:/|")`), `template hard-codes ${id}`);
    assert.ok(!template.includes(`https://${id}.proappstore.online`), `template links ${id}'s app URL`);
  }
});

test('every app detail page links to /promoters?app=<its own id>#choose', () => {
  const { out } = build();
  try {
    const ids = JSON.parse(fs.readFileSync(FIXTURE_REGISTRY, 'utf8')).apps.map((a) => a.id);
    for (const id of ids) {
      const html = read(out, path.join('apps', id, 'index.html'));
      assert.ok(html.includes(`<a href="/promoters?app=${id}#choose" class="app-btn-secondary">Help promote `), id);
      assert.equal((html.match(/\/promoters\?app=/g) || []).length, 2);
    }
  } finally { cleanup(out); }
});

test('the Promote link sits in the header and footer navigation of every storefront page', () => {
  const nav = '<a href="/developers">Developers</a>';
  const files = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    ...fs.readdirSync(path.join(ROOT, 'templates')).map((f) => path.join('templates', f)),
    ...fs.readdirSync(path.join(ROOT, 'apps')).map((d) => path.join('apps', d, 'index.html')).filter((f) => fs.existsSync(path.join(ROOT, f))),
    ...fs.readdirSync(path.join(ROOT, 'developers')).map((d) => path.join('developers', d, 'index.html')),
  ];
  let checked = 0;
  for (const f of files) {
    const lines = read(ROOT, f).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.trim() !== nav) return;
      checked++;
      assert.equal(lines[i + 1].trim(), '<a href="/promoters">Promote</a>', `${f}:${i + 1} has Developers without Promote`);
    });
  }
  assert.ok(checked >= 60, `only ${checked} nav entries checked`);
  const { out } = build();
  try {
    for (const f of ['index.html', 'ideas.html', 'developers.html', 'promoters.html']) {
      assert.equal((read(out, f).match(/<a href="\/promoters">Promote<\/a>/g) || []).length, 2, f);
    }
  } finally { cleanup(out); }
});

const CONSOLE = 'https://console.proappstore.online/';
const ENTRY = CONSOLE + '#/promoter';

test('buildDestination accepts Console entry, return, and raw app IDs with hash context', () => {
  assert.equal(buildDestination(ENTRY), ENTRY);
  assert.equal(buildDestination('alpha'), ENTRY + '?app=alpha');
  assert.equal(buildDestination(ENTRY + '?app=alpha'), ENTRY + '?app=alpha');
  assert.equal(buildDestination(ENTRY, 'beta-2', ['beta-2']), ENTRY + '?app=beta-2');
  assert.equal(buildDestination(ENTRY + '?app=alpha', '', ['alpha']), ENTRY);
  assert.equal(buildDestination(ENTRY + '/return?app=alpha'), ENTRY + '/return?app=alpha');
  assert.equal(buildDestination('a'.repeat(56)), ENTRY + '?app=' + 'a'.repeat(56));
});

test('buildDestination throws RangeError for malformed or non-public app selections', () => {
  for (const id of ['unknown', 'ALPHA', 'alpha ', 'alpha\n', 'alpha&next=x', '../alpha', 'a%2fb', 'a'.repeat(57), 123, {}]) {
    assert.throws(() => buildDestination(ENTRY, id, ['alpha']), RangeError);
  }
  for (const id of ['', 'ALPHA', 'a b', 'alpha\n', 'a/b', 'x'.repeat(57)]) {
    assert.throws(() => buildDestination(ENTRY + '?app=' + encodeURIComponent(id)), RangeError);
  }
  assert.throws(() => buildDestination(ENTRY, 'alpha', []), RangeError);
  assert.throws(() => buildDestination(ENTRY, 'alpha', 'alpha'), RangeError);
});

test('buildDestination rejects hostile origins, outer queries, credentials and unrecognized routes', () => {
  for (const base of [
    'https://evil.example/#/promoter', 'https://proappstore.online/#/promoter',
    'https://other.proappstore.online/#/promoter', 'http://console.proappstore.online/#/promoter',
    'https://user:pw@console.proappstore.online/#/promoter', 'https://console.proappstore.online:8443/#/promoter',
    CONSOLE + '?next=https://evil.example#/promoter', CONSOLE + '?app=alpha#/promoter',
    CONSOLE + 'elsewhere#/promoter', CONSOLE + '#/promoter-evil', CONSOLE + '#/promoter/other',
    ENTRY + '?next=evil', ENTRY + '?app=alpha&app=beta', ENTRY + '?app=alpha#evil',
    ENTRY + '\n', ENTRY + '\\', 'javascript:alert(1)', '/app/promoter', '', null, undefined, 42,
  ]) assert.throws(() => buildDestination(base), RangeError, String(base));
});
