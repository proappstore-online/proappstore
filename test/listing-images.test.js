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

test('renamed hosts keep uploads scoped to their stable platform identity', () => {
  const host = 'https://rideshare.proappstore.online';
  assert.equal(ownedUrl('https://api.proappstore.online/v1/apps/stable-id/public/icon.png', host, host, 'stable-id'), 'https://api.proappstore.online/v1/apps/stable-id/public/icon.png');
  assert.equal(ownedUrl('https://api.proappstore.online/v1/apps/rideshare/public/icon.png', host, host, 'stable-id'), null);
});

// A stub app: manifest at /manifest.json, root HTML with optional og:image, and only the listed paths serve a PNG.
async function enrich(manifestIcons, { og, images = [], app = {} } = {}) {
  const head = `<link rel="manifest" href="/manifest.json">${og ? `<meta property="og:image" content="${og}">` : ''}`;
  const pages = new Map([['sample', head]]);
  const served = new Set(images.map(image => new URL(image, 'https://sample.proappstore.online').href));
  const result = await enrichListingImages({ apps: [{ ...registry.apps[0], ...app }] }, pages, async url => {
    if (url === 'https://sample.proappstore.online/manifest.json') return Response.json({ icons: manifestIcons });
    if (url === FALLBACK || served.has(url)) return png();
    return new Response('not found', { status: 404 });
  });
  return result.apps[0];
}

test('a 512x512 any-purpose manifest icon becomes the iconUrl', async () => {
  const app = await enrich([{ src: '/icon-512.png', sizes: '512x512', purpose: 'any maskable' }], { images: ['/icon-512.png'] });
  assert.equal(app.iconUrl, 'https://sample.proappstore.online/icon-512.png');
  assert.equal(app.socialImageUrl, 'https://sample.proappstore.online/icon-512.png');
});

test('a manifest with only a 192x192 icon publishes no iconUrl and keeps the socialImageUrl', async () => {
  const app = await enrich([{ src: '/icon-192.png', sizes: '192x192' }], { images: ['/icon-192.png'] });
  assert.equal('iconUrl' in app, false);
  assert.equal(app.socialImageUrl, 'https://sample.proappstore.online/icon-192.png');
});

test('a maskable-only 512 icon is not an iconUrl', async () => {
  const app = await enrich([{ src: '/maskable-512.png', sizes: '512x512', purpose: 'maskable' }], { images: ['/maskable-512.png'] });
  assert.equal('iconUrl' in app, false);
});

test('a declared icon that 404s never falls back to the store logo as iconUrl', async () => {
  const app = await enrich([{ src: '/icon-512.png', sizes: '512x512' }]);
  assert.equal('iconUrl' in app, false);
  assert.equal(app.socialImageUrl, FALLBACK);
});

test('heroImageUrl is a distinct owned og:image, and absent when it is the icon or off-origin', async () => {
  const icons = [{ src: '/icon-512.png', sizes: '512x512' }];
  const images = ['/icon-512.png', '/og.png'];
  assert.equal((await enrich(icons, { og: '/og.png', images })).heroImageUrl, 'https://sample.proappstore.online/og.png');
  assert.equal('heroImageUrl' in await enrich(icons, { og: '/icon-512.png', images }), false);
  assert.equal('heroImageUrl' in await enrich(icons, { og: 'https://unowned.example/og.png', images }), false);
});

test('a valid owned listingIconUrl beats the manifest icon and is not published', async () => {
  const upload = 'https://api.proappstore.online/v1/apps/sample/public/icon.png';
  const app = await enrich([{ src: '/icon-512.png', sizes: '512x512' }], { images: ['/icon-512.png', upload], app: { listingIconUrl: upload } });
  assert.equal(app.iconUrl, upload);
  assert.equal('listingIconUrl' in app, false);
});
