const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const fixture = join(root, 'marketing/fixtures/sample.json');
const assets = join(root, 'marketing/fixtures/sample/assets');

function build(snapshot, out, extra = []) {
  return spawnSync(process.execPath, [join(root, 'marketing/build.mjs'), '--snapshot', snapshot, '--assets-dir', assets, '--out', out, ...extra], {
    cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
}

test('Astro builds a complete, revisioned static marketing site from approved content', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-test-'));
  try {
    const out = join(temp, 'site');
    const result = build(fixture, out);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(html, /<h1[^>]*>Keep your project work in one place<\/h1>/);
    assert.match(html, /See the work/);
    assert.match(html, /How it works/);
    assert.match(html, /Take a closer look/);
    assert.match(html, /href="https:\/\/sample-app\.proappstore\.online\/"/);
    assert.match(html, /rel="canonical" href="https:\/\/about-sample-app\.proappstore\.online\/"/);
    assert.match(html, /application\/ld\+json/);
    assert.doesNotMatch(html, /<script[^>]+src=/);
    const manifest = JSON.parse(readFileSync(join(out, 'artifact-manifest.json'), 'utf8'));
    assert.equal(manifest.appId, 'sample-app');
    assert.equal(manifest.revision, 'fixture-v1');
    assert.equal(manifest.preview, false);
    for (const file of manifest.files) {
      const bytes = readFileSync(join(out, file.path.slice(1)));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      assert.equal(bytes.length, file.size);
    }
    assert.match(readFileSync(join(out, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/about-sample-app/);
    assert.match(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /about-sample-app\.proappstore\.online/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('preview is noindex and absent from the sitemap', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-preview-'));
  try {
    const out = join(temp, 'site');
    const result = build(fixture, out, ['--preview']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /content="noindex, nofollow"/);
    assert.ok(readFileSync(join(out, 'robots.txt'), 'utf8').includes('Disallow: /\n'));
    assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<url>/);
    assert.equal(JSON.parse(readFileSync(join(out, 'artifact-manifest.json'), 'utf8')).preview, true);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('incomplete content and unsafe asset paths cannot build an artifact', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-invalid-'));
  try {
    const invalid = JSON.parse(readFileSync(fixture, 'utf8'));
    invalid.benefits = [];
    const snapshot = join(temp, 'invalid.json');
    writeFileSync(snapshot, JSON.stringify(invalid));
    let result = build(snapshot, join(temp, 'site'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /benefits must have 3-8 items/);

    invalid.benefits = JSON.parse(readFileSync(fixture, 'utf8')).benefits;
    invalid.heroImage.src = '/assets/../private.png';
    writeFileSync(snapshot, JSON.stringify(invalid));
    result = build(snapshot, join(temp, 'site'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /local PNG, JPEG or WebP asset/);

    invalid.heroImage.src = '/assets/sample.png';
    invalid.theme.accent = '#ffffff';
    writeFileSync(snapshot, JSON.stringify(invalid));
    result = build(snapshot, join(temp, 'site'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contrast with white text/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('owner-authored text cannot inject HTML or a JSON-LD script', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-escape-'));
  try {
    const snapshot = join(temp, 'input.json');
    const content = JSON.parse(readFileSync(fixture, 'utf8'));
    content.name = '</script><script>alert(1)</script>" onmouseover="alert(2)';
    content.heroImage.alt = 'preview" onerror="alert(3)';
    writeFileSync(snapshot, JSON.stringify(content));
    const out = join(temp, 'site');
    const result = build(snapshot, out);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, / onmouseover="alert\(2\)"/);
    assert.doesNotMatch(html, / onerror="alert\(3\)"/);
    assert.match(html, /&lt;\/script&gt;/);
    assert.match(html, /\\u003c\/script>/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('Astro escapes owner copy once in metadata and image attributes', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-entities-'));
  try {
    const snapshot = join(temp, 'input.json');
    const content = JSON.parse(readFileSync(fixture, 'utf8'));
    content.name = 'A & B';
    content.summary = 'Plan & share';
    content.heroImage.alt = 'Tasks & people';
    writeFileSync(snapshot, JSON.stringify(content));
    const out = join(temp, 'site');
    const result = build(snapshot, out);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(html, /content="Plan &amp; share"/);
    assert.match(html, /aria-label="A &amp; B home"/);
    assert.match(html, /alt="Tasks &amp; people"/);
    assert.doesNotMatch(html, /&amp;amp;/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('output cannot erase its input snapshot, including through a symlink', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pas-marketing-output-'));
  try {
    const snapshot = join(temp, 'input.json');
    writeFileSync(snapshot, readFileSync(fixture));
    const direct = build(snapshot, temp);
    assert.notEqual(direct.status, 0);
    assert.match(direct.stderr, /unsafe output directory/);
    assert.equal(readFileSync(snapshot, 'utf8'), readFileSync(fixture, 'utf8'));

    const alias = join(temp, 'alias');
    symlinkSync(temp, alias, 'dir');
    const linked = build(snapshot, alias);
    assert.notEqual(linked.status, 0);
    assert.match(linked.stderr, /unsafe output directory/);
    assert.equal(readFileSync(snapshot, 'utf8'), readFileSync(fixture, 'utf8'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
