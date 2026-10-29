'use strict';

// App ideas page (/ideas): the shared module stays identical to FreeAppStore's,
// the committed data validates, and the build renders Pro-only ideas with
// cross-links to FreeAppStore.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateIdeas, validateCapabilities } = require('../scripts/ideas.cjs');

const ROOT = path.resolve(__dirname, '..');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

test('committed ideas data and both capability manifests are valid', () => {
  assert.deepEqual(validateIdeas(readJson('data/app-ideas.json')), []);
  const pas = readJson('data/capabilities.json');
  const fas = readJson('data/fas-capabilities.json');
  assert.deepEqual(validateCapabilities(pas), []);
  assert.deepEqual(validateCapabilities(fas), []);
  assert.equal(pas.platform, 'pas');
  assert.equal(fas.platform, 'fas');
});

test('pasApps ids exist in the registry', () => {
  const ids = new Set(readJson('registry.json').apps.map((a) => a.id));
  const missing = readJson('data/app-ideas.json').ideas.flatMap((i) => (i.pasApps || []).filter((id) => !ids.has(id)).map((id) => `${i.id} → ${id}`));
  assert.deepEqual(missing, []);
});

test('scripts/ideas.cjs and ideas.js match the FreeAppStore originals', (t) => {
  const fasRoot = path.resolve(ROOT, '../../fas/sites/storefront');
  if (!fs.existsSync(fasRoot)) return t.skip('FAS platform checkout not next to this repo');
  for (const [mine, theirs] of [['scripts/ideas.cjs', 'lib/ideas.cjs'], ['ideas.js', 'ideas.js']]) {
    assert.equal(fs.readFileSync(path.join(ROOT, mine), 'utf8'), fs.readFileSync(path.join(fasRoot, theirs), 'utf8'), `copy FAS sites/storefront/${theirs} to ${mine}`);
  }
});

test('build writes /ideas with every idea, FAS cross-links and SRI for ideas.js', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-ideas-'));
  try {
    execFileSync(process.execPath, ['build.js'], { cwd: ROOT, env: { ...process.env, OUT_DIR: out }, stdio: 'pipe' });
    const html = fs.readFileSync(path.join(out, 'ideas.html'), 'utf8');
    const ideas = readJson('data/app-ideas.json').ideas;
    for (const i of ideas) assert.ok(html.includes(`id="idea-${i.id}"`), i.id);
    assert.ok(!/{{[A-Z_]+}}/.test(html), 'no unsubstituted placeholders');
    assert.match(html, /<script src="\/ideas\.js" integrity="sha256-[^"]+"><\/script>/);
    assert.match(html, /<script src="\/ideas-claims\.js" integrity="sha256-[^"]+"><\/script>/);
    assert.ok(html.includes('https://freeappstore.online/ideas#idea-'), 'links ideas FAS can build to FreeAppStore');
    assert.ok(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').includes('https://proappstore.online/ideas</loc>'));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
