const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { enrichListingImages, FALLBACK, ownedUrl } = require('../scripts/listing-images.cjs');
const registry = { apps: [{ id: 'sample', appUrl: 'https://sample.proappstore.online' }] };
const png = () => new Response(fs.readFileSync(path.join(__dirname, '../icon-512.png')), { headers: { 'content-type': 'image/png' } });

test('resolves nested manifest icons against the manifest URL rather than guessing a root icon', async () => {
  const pages = new Map([['sample', '<link href="/assets/app.webmanifest" rel="manifest">']]);
  const calls = [];
  const result = await enrichListingImages(registry, pages, async url => {
    calls.push(url);
    if (url.endsWith('.webmanifest')) return Response.json({ icons: [{ src: 'icons/brand.png', sizes: '512x512' }] });
    if (url === 'https://sample.proappstore.online/assets/icons/brand.png') return png();
    return new Response('not found', { status: 404 });
  });
  assert.equal(result.apps[0].socialImageUrl, 'https://sample.proappstore.online/assets/icons/brand.png');
  assert.ok(!calls.includes('https://sample.proappstore.online/icon-512.png'));
});

test('missing app icons use a validated store fallback and HTML is never accepted as an image', async () => {
  const pages = new Map([['sample', '<link rel="manifest" href="/manifest.json">']]);
  const result = await enrichListingImages(registry, pages, async url => {
    if (url.endsWith('/manifest.json')) return Response.json({ icons: [{ src: '/missing.png', sizes: '512x512' }] });
    if (url === FALLBACK) return png();
    return new Response('<html>not an image</html>', { headers: { 'content-type': 'text/html' } });
  });
  assert.equal(result.apps[0].socialImageUrl, FALLBACK);
});

test('does not follow arbitrary external manifest URLs and refuses a broken fallback', async () => {
  const pages = new Map([['sample', '<link rel="manifest" href="https://unowned.example/manifest.json">']]);
  const calls = [];
  await assert.rejects(enrichListingImages(registry, pages, async url => {
    calls.push(url);
    return new Response('gone', { status: 404 });
  }), /no valid owned listing image/);
  assert.deepEqual(calls, [FALLBACK]);
});

test('approved API uploads are scoped to the same app public-file namespace', () => {
  assert.equal(ownedUrl('https://api.proappstore.online/v1/apps/sample/public/icon.png', registry.apps[0].appUrl, registry.apps[0].appUrl), 'https://api.proappstore.online/v1/apps/sample/public/icon.png');
  assert.equal(ownedUrl('https://api.proappstore.online/v1/admin/something', registry.apps[0].appUrl, registry.apps[0].appUrl), null);
  assert.equal(ownedUrl('https://api.proappstore.online/v1/apps/another/public/icon.png', registry.apps[0].appUrl, registry.apps[0].appUrl), null);
});
