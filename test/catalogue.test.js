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

test('robots none is an index exclusion in supported meta and header contexts', async () => {
  for (const excludedResponse of [
    () => response(200, '<meta name="robots" content="none">'),
    () => response(200, '<META CONTENT="NoNe" NAME="GoOgLeBoT">'),
    () => new Response('<html>Excluded</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'none' } }),
    () => new Response('<html>Excluded</html>', { headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'googlebot: NONE' } }),
  ]) {
    const result = await reconcile({ apps: [app('public'), app('excluded')] }, inventory('public', 'excluded'), async url => url.includes('excluded') ? excludedResponse() : response());
    assert.deepEqual(result.registry.apps.map(a => a.id), ['public']);
    assert.equal(result.report.excluded[0].reason, 'explicit noindex');
  }
});

test('placeholder owner copy cannot replace an approved catalogue description', async () => {
  const result = await reconcile({ apps: [app('public')] }, { apps: [{ appId: 'public', tagline: 'x'.repeat(60) }] }, async () => response());
  assert.equal(result.registry.apps[0].description, 'Approved description');
  const realCopy = await reconcile({ apps: [app('public')] }, { apps: [{ appId: 'public', tagline: '  Organize your community events.  ' }] }, async () => response());
  assert.equal(realCopy.registry.apps[0].description, 'Organize your community events.');
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
