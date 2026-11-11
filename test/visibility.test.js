const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { parseInventory, isPrivateEntry, filterPublic } = require('../scripts/public-inventory.cjs');

const ROOT = path.resolve(__dirname, '..');
const BUILD_JS = path.join(ROOT, 'build.js');
const run = promisify(execFile);

const app = (id, extra = {}) => ({
  id, name: `App ${id}`, category: 'productivity', description: `Synthetic ${id}.`,
  appUrl: `https://${id}.proappstore.online`, repo: `proappstore-online/${id}`, developer: 'ProAppStore', ...extra,
});
const inventoryOf = (...ids) => ({ apps: ids.map((appId) => ({ appId })) });
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const writeJson = (dir, name, value) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

/** Synthetic build. `inventory` undefined => no inventory env (offline build). */
function build({ apps, inventory, out = tmp('pas-vis-out-'), env = {} }) {
  const work = tmp('pas-vis-in-');
  const childEnv = { ...process.env, REGISTRY_PATH: writeJson(work, 'registry.json', { apps }), OUT_DIR: out, ...env };
  delete childEnv.PUBLIC_INVENTORY; delete childEnv.PUBLIC_INVENTORY_PATH; delete childEnv.PUBLIC_INVENTORY_URL;
  Object.assign(childEnv, env);
  if (inventory !== undefined) childEnv.PUBLIC_INVENTORY_PATH = typeof inventory === 'string' ? inventory : writeJson(work, 'inventory.json', inventory);
  try {
    const stdout = execFileSync(process.execPath, [BUILD_JS], { env: childEnv, cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, out, stdout, stderr: '', work };
  } catch (error) {
    return { ok: false, out, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message), work };
  }
}
const cleanup = (...dirs) => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));

/** Every place an app id could leak into storefront output. */
function leaks(out, id) {
  const found = [];
  if (fs.existsSync(path.join(out, 'apps', id))) found.push(`apps/${id}/ page`);
  for (const file of ['index.html', 'sitemap.xml', 'sitemap-index.xml', 'catalogue.json', 'promoters.html', 'ideas.html', 'card-styles.css']) {
    if (fs.existsSync(path.join(out, file)) && read(out, file).includes(id)) found.push(file);
  }
  return found;
}

test('a private app in registry.json produces no card, page, sitemap, catalogue, promoter or ideas entry', () => {
  const r = build({ apps: [app('open-one'), app('open-two'), app('went-private')], inventory: inventoryOf('open-one', 'open-two') });
  try {
    assert.equal(r.ok, true, r.stderr);
    assert.deepEqual(leaks(r.out, 'went-private'), []);
    assert.match(r.stdout, /Not rendering went-private: not in the public inventory/);
    for (const id of ['open-one', 'open-two']) {
      assert.ok(fs.existsSync(path.join(r.out, 'apps', id, 'index.html')), `${id} page missing`);
      assert.match(read(r.out, 'index.html'), new RegExp(`data-id="${id}"`));
      assert.ok(read(r.out, 'sitemap.xml').includes(`/apps/${id}/`));
      assert.ok(read(r.out, 'promoters.html').includes(`data-app-id="${id}"`));
    }
    assert.deepEqual(JSON.parse(read(r.out, 'catalogue.json')).apps.map((a) => a.id), ['open-one', 'open-two']);
  } finally { cleanup(r.out, r.work); }
});

test("a private app's first publish (entry written before its manifest registered) is dropped once it leaves the inventory", () => {
  const apps = [app('open-one'), app('first-publish-private')];
  const before = build({ apps, inventory: inventoryOf('open-one', 'first-publish-private') });
  const after = build({ apps, inventory: inventoryOf('open-one') });
  try {
    assert.deepEqual(leaks(before.out, 'first-publish-private').includes('apps/first-publish-private/ page'), true, 'sanity: public app does render');
    assert.deepEqual(leaks(after.out, 'first-publish-private'), []);
  } finally { cleanup(before.out, before.work, after.out, after.work); }
});

test('an app that flips to private disappears on the next rebuild, including its stale page', () => {
  const out = tmp('pas-vis-flip-');
  const apps = [app('stays'), app('flips')];
  const first = build({ apps, inventory: inventoryOf('stays', 'flips'), out });
  const second = build({ apps, inventory: inventoryOf('stays'), out });
  try {
    assert.equal(first.ok && second.ok, true, first.stderr + second.stderr);
    assert.ok(read(first.out, 'sitemap.xml').includes('/apps/stays/'));
    // Same OUT_DIR rebuilt after the flip: the page generated earlier must not survive.
    assert.deepEqual(leaks(out, 'flips'), []);
    assert.ok(fs.existsSync(path.join(out, 'apps', 'stays', 'index.html')));
  } finally { cleanup(out, first.work, second.work); }
});

test('the build fails, writes nothing, and does not list everything when the inventory cannot be read', () => {
  const work = tmp('pas-vis-bad-');
  const cases = {
    'missing file': path.join(work, 'nope.json'),
    'not json': writeJson(work, 'a.json', '<html>502 Bad Gateway</html>'),
    'empty list': writeJson(work, 'b.json', { apps: [] }),
    'no apps key': writeJson(work, 'c.json', { error: 'boom' }),
    'row without appId': writeJson(work, 'd.json', { apps: [{ id: 'x' }] }),
  };
  try {
    for (const [label, file] of Object.entries(cases)) {
      const r = build({ apps: [app('open-one'), app('went-private')], inventory: file });
      try {
        assert.equal(r.ok, false, `${label}: build succeeded`);
        assert.match(r.stderr, /Public inventory unavailable, refusing to build with every registry app/, label);
        for (const f of ['index.html', 'sitemap.xml', 'catalogue.json']) assert.ok(!fs.existsSync(path.join(r.out, f)), `${label}: ${f} was written`);
      } finally { cleanup(r.out, r.work); }
    }
  } finally { cleanup(work); }
});

test('a build whose inventory leaves no public app fails instead of publishing an empty storefront', () => {
  const r = build({ apps: [app('only-private')], inventory: inventoryOf('something-else') });
  try {
    assert.equal(r.ok, false);
    assert.match(r.stderr, /No public apps left to render/);
    assert.ok(!fs.existsSync(path.join(r.out, 'index.html')));
  } finally { cleanup(r.out, r.work); }
});

test('entries that declare themselves private never render, even in an offline build', () => {
  const apps = [
    app('open-one'),
    app('flag-private', { private: true }),
    app('vis-private', { visibility: 'private' }),
    app('vis-hidden', { visibility: 'Hidden' }),
    app('vis-unlisted', { visibility: ' unlisted ' }),
    app('vis-public', { visibility: 'public' }),
  ];
  const r = build({ apps });
  try {
    assert.equal(r.ok, true, r.stderr);
    assert.match(r.stdout, /Public inventory not loaded|Not rendering/);
    for (const id of ['flag-private', 'vis-private', 'vis-hidden', 'vis-unlisted']) assert.deepEqual(leaks(r.out, id), [], id);
    for (const id of ['open-one', 'vis-public']) assert.ok(fs.existsSync(path.join(r.out, 'apps', id, 'index.html')), id);
  } finally { cleanup(r.out, r.work); }
});

test('PUBLIC_INVENTORY=live reads the API at build time: filters on success, fails closed on error, empty or unreachable', async () => {
  let reply = { status: 200, body: inventoryOf('open-one') };
  const server = http.createServer((req, res) => {
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/v1/storefront/apps`;
  const apps = [app('open-one'), app('went-private')];
  const attempt = async (envUrl) => {
    const out = tmp('pas-vis-live-out-');
    const work = tmp('pas-vis-live-in-');
    const env = { ...process.env, REGISTRY_PATH: writeJson(work, 'registry.json', { apps }), OUT_DIR: out, PUBLIC_INVENTORY: 'live', PUBLIC_INVENTORY_URL: envUrl };
    delete env.PUBLIC_INVENTORY_PATH;
    try {
      await run(process.execPath, [BUILD_JS], { env, cwd: ROOT });
      return { ok: true, out, work };
    } catch (error) {
      return { ok: false, out, work, stderr: String(error.stderr || error.message) };
    }
  };
  try {
    const good = await attempt(url);
    assert.equal(good.ok, true, good.stderr);
    assert.deepEqual(leaks(good.out, 'went-private'), []);
    assert.ok(fs.existsSync(path.join(good.out, 'apps', 'open-one', 'index.html')));
    cleanup(good.out, good.work);

    for (const [label, bad] of Object.entries({
      'http 500': { status: 500, body: { error: 'down' } },
      'http 404': { status: 404, body: { error: 'gone' } },
      'empty inventory': { status: 200, body: { apps: [] } },
      'html error page': { status: 200, body: '<html>Bad gateway</html>' },
    })) {
      reply = bad;
      const r = await attempt(url);
      assert.equal(r.ok, false, `${label}: build succeeded`);
      assert.match(r.stderr, /refusing to build with every registry app/, label);
      assert.ok(!fs.existsSync(path.join(r.out, 'index.html')), `${label}: index.html written`);
      cleanup(r.out, r.work);
    }

    const down = await attempt('http://127.0.0.1:1/v1/storefront/apps'); // nothing listens on port 1
    assert.equal(down.ok, false);
    assert.match(down.stderr, /refusing to build with every registry app/);
    assert.ok(!fs.existsSync(path.join(down.out, 'index.html')));
    cleanup(down.out, down.work);
  } finally { server.close(); }
});

test('parseInventory, isPrivateEntry and filterPublic', () => {
  assert.deepEqual([...parseInventory(inventoryOf('a', 'b'))], ['a', 'b']);
  for (const bad of [null, undefined, {}, { apps: [] }, { apps: 'x' }, { apps: [{}] }, { apps: [{ appId: '' }] }, { apps: [null] }]) {
    assert.throws(() => parseInventory(bad), /Public inventory/, JSON.stringify(bad));
  }
  assert.equal(isPrivateEntry({ private: true }), true);
  assert.equal(isPrivateEntry({ private: 'true' }), false);
  assert.equal(isPrivateEntry({ visibility: 'PRIVATE' }), true);
  assert.equal(isPrivateEntry({ visibility: 'public' }), false);
  assert.equal(isPrivateEntry({}), false);
  const { kept, dropped } = filterPublic([{ id: 'a' }, { id: 'b' }, { id: 'c', private: true }], new Set(['a', 'c']));
  assert.deepEqual(kept.map((x) => x.id), ['a']);
  assert.deepEqual(dropped.map((x) => `${x.id}:${x.reason}`), ['b:not in the public inventory', 'c:entry is marked private']);
  assert.deepEqual(filterPublic([{ id: 'a' }], null).kept.length, 1, 'no inventory => only explicit flags apply');
});

test('deploy.yml rebuilds on a schedule and on visibility events, and builds with the live inventory gate', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(yml, /schedule:\s*\n(?:\s*#.*\n)*\s*- cron: '\d{1,2} \* \* \* \*'/, 'needs an hourly schedule');
  assert.match(yml, /repository_dispatch:\s*\n(?:\s*#.*\n)*\s*types: \[app-visibility-changed\]/);
  assert.match(yml, /concurrency:\s*\n(?:\s*#.*\n)*\s*group: deploy-storefront\s*\n\s*cancel-in-progress: false/);
  const step = yml.split(/\n      - name: /).find((s) => s.startsWith('Build storefront'));
  assert.ok(step, 'Build storefront step not found');
  assert.match(step, /PUBLIC_INVENTORY: live/);
  assert.match(step, /REGISTRY_PATH: \.catalogue-build\.json/);
  assert.doesNotMatch(yml, /continue-on-error|\|\|\s*true/, 'a failing gate must fail the deploy');
  assert.ok(yml.indexOf('PUBLIC_INVENTORY: live') < yml.indexOf('wrangler pages deploy'), 'gate must run before the deploy');
});

test('README states the flip-to-storefront time and the fail-closed rule', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /At most about one hour/);
  assert.match(readme, /app-visibility-changed/);
  assert.match(readme, /build fails/);
  assert.match(readme, /PUBLIC_INVENTORY=live/);
});
