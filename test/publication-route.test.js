const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../functions/apps/[[path]].js'), 'utf8');
const handler = import(`data:text/javascript,${encodeURIComponent(source.replace("import catalogue from '../../catalogue.json';", 'const catalogue = { apps: [{ id: "live" }, { id: "stable-id", publicSlug: "rideshare" }] };'))}`);

test('a removed fixture, private or retired listing cannot leak through a cached Pages asset', async () => {
  const { onRequest } = await handler;
  for (const slug of ['retired', 'private', 'smoke-test']) {
    const response = await onRequest({ request: new Request(`https://proappstore.online/apps/${slug}/`), next() { throw new Error('Must not serve cached HTML'); } });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  }
});

test('eligible clean and explicit index URLs preserve Pages behavior; withdrawn HEAD has no body', async () => {
  const { onRequest } = await handler;
  for (const route of ['live', 'live/', 'live/index.html']) {
    const response = await onRequest({ request: new Request(`https://proappstore.online/apps/${route}`), next: async () => new Response('Published app') });
    assert.equal(await response.text(), 'Published app');
  }
  const head = await onRequest({ request: new Request('https://proappstore.online/apps/retired/', { method: 'HEAD' }) });
  assert.equal(head.status, 404);
  assert.equal(await head.text(), '');
});


test('renamed public listing serves its slug and redirects its old identity without losing query', async () => {
  const { onRequest } = await handler;
  const result = await onRequest({ request: new Request('https://proappstore.online/apps/rideshare/'), next: async () => new Response('Rideshare') });
  assert.equal(await result.text(), 'Rideshare');
  for (const method of ['GET', 'HEAD']) {
    const old = await onRequest({ request: new Request('https://proappstore.online/apps/stable-id/?ref=test', { method }), next() { throw new Error('Must redirect'); } });
    assert.equal(old.status, 301);
    assert.equal(old.headers.get('location'), 'https://proappstore.online/apps/rideshare/?ref=test');
  }
});
