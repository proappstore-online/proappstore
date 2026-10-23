const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../functions/apps/[[path]].js'), 'utf8');
const handler = import(`data:text/javascript,${encodeURIComponent(source.replace("import catalogue from '../../catalogue.json';", 'const catalogue = { apps: [{ id: "live" }] };'))}`);

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
