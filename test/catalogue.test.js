const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcile } = require('../scripts/reconcile-catalogue.cjs');
const app = id => ({ id, name: id, description: 'Approved description', appUrl: `https://${id}.proappstore.online` });
const inventory = (...ids) => ({ apps: ids.map(appId => ({ appId })) });
const response = (status = 200, html = '<html>App</html>') => new Response(html, { status, headers: { 'content-type': 'text/html' } });

test('catalogue uses explicit copy approval, live public visibility, healthy roots and noindex intent', async () => {
  const result = await reconcile({ apps: ['public', 'private', 'retired', 'noindex'].map(app) }, inventory('public', 'retired', 'noindex', 'smoke-test'), async url => response(url.includes('retired') ? 404 : 200, url.includes('noindex') ? '<meta content="noindex,follow" name="robots">' : '<html>App</html>'));
  assert.deepEqual(result.registry.apps.map(a => a.id), ['public']);
  assert.deepEqual(result.report.pending.map(a => a.id), ['smoke-test']);
  assert.equal(result.report.excluded.length, 3);
});

test('a transient service failure aborts the build instead of deleting approved listings', async () => {
  await assert.rejects(reconcile({ apps: [app('public')] }, inventory('public'), async () => response(503)), /retry instead of silently delisting/);
  await assert.rejects(reconcile({ apps: [app('public')] }, { apps: [] }), /refusing a destructive rebuild/);
});

test('an explicitly approved workspace listing preserves noindex and never advertises its app sitemap', async () => {
  for (const get of [
    async () => response(200, '<meta name="robots" content="noindex,nofollow">'),
    async () => new Response('<html>Workspace</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'none' } }),
  ]) {
    const result = await reconcile({ apps: [{ ...app('workspace'), allowNoindexListing: true }] }, inventory('workspace'), get);
    assert.deepEqual(result.report.published, ['workspace']);
    assert.equal(result.registry.apps[0].sitemapUrl, null);
    assert.equal(result.report.excluded.length, 0);
  }
});

test('workspace listing approval cannot override visibility, missing routes, or come from app metadata', async () => {
  const entries = ['private', 'retired', 'unapproved'].map(id => ({ ...app(id), allowNoindexListing: id === 'unapproved' ? 'true' : true }));
  const live = inventory('public', 'retired', 'unapproved');
  live.apps.find(a => a.appId === 'unapproved').allowNoindexListing = true;
  const result = await reconcile({ apps: [app('public'), ...entries] }, live, async url =>
    response(url.includes('retired') ? 404 : 200, url.includes('unapproved') ? '<meta name="robots" content="noindex">' : '<html>App</html>'));
  assert.deepEqual(result.report.published, ['public']);
  assert.deepEqual(result.report.excluded.map(a => a.reason), ['not in public inventory', 'launch HTTP 404', 'explicit noindex']);
});

test('robots none is an index exclusion in supported meta and header contexts', async () => {
  for (const excludedResponse of [
    () => response(200, '<meta name="robots" content="none">'),
    () => response(200, '<META CONTENT="NoNe" NAME="GoOgLeBoT">'),
    () => new Response('<html>Excluded</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'none' } }),
    () => new Response('<html>Excluded</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'googlebot: NONE' } }),
    () => new Response('<html>Excluded</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'googlebot:none' } }),
  ]) {
    const result = await reconcile({ apps: [app('public'), app('excluded')] }, inventory('public', 'excluded'), async url => url.includes('excluded') ? excludedResponse() : response());
    assert.deepEqual(result.registry.apps.map(a => a.id), ['public']);
    assert.equal(result.report.excluded[0].reason, 'explicit noindex');
  }
});

test('preview restrictions and unrelated words do not exclude indexing', async () => {
  for (const html of ['<meta name="robots" content="max-image-preview:none, follow">', '<meta name="robots" content="noindex-example">']) {
    const result = await reconcile({ apps: [app('public')] }, inventory('public'), async () =>
      new Response(html, { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'googlebot:max-image-preview:none' } }));
    assert.deepEqual(result.report.published, ['public']);
  }
});

test('placeholder owner copy cannot replace an approved catalogue description', async () => {
  const result = await reconcile({ apps: [app('public')] }, { apps: [{ appId: 'public', tagline: 'x'.repeat(60) }] }, async () => response());
  assert.equal(result.registry.apps[0].description, 'Approved description');
  const realCopy = await reconcile({ apps: [app('public')] }, { apps: [{ appId: 'public', tagline: '  Organize your community events.  ' }] }, async () => response());
  assert.equal(realCopy.registry.apps[0].description, 'Organize your community events.');
});

test('the app website comes from the public inventory, not from a typed registry value', async () => {
  const live = { apps: [
    { appId: 'withsite', websiteUrl: 'https://about-withsite.proappstore.online' },
    { appId: 'unpublished', websiteUrl: null },
    { appId: 'foreign', websiteUrl: 'https://about-other.proappstore.online' },
  ] };
  const typed = { ...app('unpublished'), websiteUrl: 'https://about-unpublished.proappstore.online' };
  const result = await reconcile({ apps: [app('withsite'), typed, app('foreign')] }, live, async () => response());
  assert.deepEqual(result.registry.apps.map(a => a.websiteUrl), ['https://about-withsite.proappstore.online', undefined, undefined]);
});

test('app sitemap discovery follows public readiness and canonical ownership', async () => {
  const result = await reconcile({ apps: [...['primary', 'custom', 'hidden', 'empty'].map(app), { ...app('custom-primary'), sitemapUrl: null }] }, inventory('primary', 'custom', 'hidden', 'empty', 'custom-primary'), async url => {
    if (url.includes('empty')) return response(404);
    if (url.includes('hidden')) return response(200, '<meta name="robots" content="noindex">');
    if (url.includes('custom.')) return response(200, '<link href="https://custom.example/" rel="canonical">');
    return response(200, '<link rel="canonical" href="/">');
  });
  assert.deepEqual(result.registry.apps.map(a => [a.id, a.sitemapUrl]), [['primary', 'https://primary.proappstore.online/sitemap.xml'], ['custom', null], ['custom-primary', null]]);
});

test('the published registry names no one: developer, repo, creatorGithub and developers[] are stripped', async () => {
  const named = { ...app('public'), developer: 'Zed Quillfeather', repo: 'zedq/secret', creatorGithub: 'zedq' };
  const result = await reconcile({ developers: [{ id: 'zedq', github: 'zedq' }], apps: [named] }, inventory('public'), async () => response());
  assert.ok(!('developers' in result.registry));
  assert.deepEqual(Object.keys(result.registry.apps[0]).filter(k => ['developer', 'repo', 'creatorGithub'].includes(k)), []);
});

test('a public listing slug preserves backend identity and visibility filtering', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');
  const { filterPublic } = require('../scripts/public-inventory.cjs');
  const root = path.resolve(__dirname, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-rename-'));
  const entry = { ...app('stable-id'), name: 'Rideshare', publicSlug: 'rideshare', appUrl: 'https://rideshare.proappstore.online' };
  try {
    assert.deepEqual(filterPublic([entry], new Set(['rideshare'])).kept, []);
    assert.equal(filterPublic([entry], new Set(['stable-id'])).kept.length, 1);
    const registryPath = path.join(tmp, 'registry.json');
    const out = path.join(tmp, 'out');
    fs.mkdirSync(out);
    fs.writeFileSync(registryPath, JSON.stringify({ apps: [entry] }));
    execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, stdio: 'pipe', env: {
      ...process.env, REGISTRY_PATH: registryPath, OUT_DIR: out,
      PROMOTER_DESTINATION_PATH: path.join(__dirname, 'fixtures', 'promoter-destination-unavailable.json'),
    } });
    const detail = fs.readFileSync(path.join(out, 'apps/rideshare/index.html'), 'utf8');
    assert.match(detail, /canonical" href="https:\/\/proappstore.online\/apps\/rideshare\//);
    assert.match(detail, /data-app-id="stable-id"/);
    assert.ok(!fs.existsSync(path.join(out, 'apps/stable-id')));
    assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /href="\/apps\/rideshare\//);
    assert.match(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), /\/apps\/rideshare\//);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
