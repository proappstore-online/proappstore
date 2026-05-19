'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILD_JS = path.join(REPO_ROOT, 'build.js');
const REAL_REGISTRY = path.join(REPO_ROOT, 'registry.json');

function runBuild({ registryPath, outDir }) {
  execFileSync(process.execPath, [BUILD_JS], {
    env: {
      ...process.env,
      REGISTRY_PATH: registryPath,
      OUT_DIR: outDir,
    },
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pas-build-test-'));
}

test('build.js writes index.html containing every app id from registry.json', () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const registry = JSON.parse(fs.readFileSync(REAL_REGISTRY, 'utf8'));

    assert.ok(registry.apps.length > 0, 'fixture registry has apps');

    for (const app of registry.apps) {
      // Every app surfaces by name and by appUrl. The id is not literal in the
      // HTML, but the appUrl is derived from it and is the load-bearing field
      // (it's what a user clicks). We assert both.
      assert.match(
        html,
        new RegExp(escapeRegExp(app.name)),
        `index.html missing app name for id="${app.id}"`,
      );
      assert.match(
        html,
        new RegExp(escapeRegExp(app.appUrl)),
        `index.html missing appUrl for id="${app.id}"`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('build.js HTML-escapes app fields (XSS injection)', () => {
  const tmp = makeTmpDir();
  const fixtureRegistry = path.join(tmp, 'registry.json');
  try {
    const base = JSON.parse(fs.readFileSync(REAL_REGISTRY, 'utf8'));
    // Fields exercised here are exactly the ones the compact card renders:
    // name, category, proFeatures. Description isn't rendered in the redesigned
    // cards (compact rows only), so we don't assert on it — but if someone
    // re-adds it, the existing esc() pipeline must catch it; that's a separate
    // test to write at the time.
    base.apps.push({
      id: 'xss-fixture',
      name: '<script>alert(1)</script>',
      category: '<img src=x onerror=alert(3)>',
      icon: '&#9888;',
      iconBg: '#fff',
      description: 'unused in current template',
      appUrl: 'https://xss.proappstore.online',
      repo: 'proappstore-online/xss-fixture',
      type: 'connected',
      developer: 'Test',
      proFeatures: ['<img src=x onerror=alert(2)>'],
    });
    fs.writeFileSync(fixtureRegistry, JSON.stringify(base));

    runBuild({ registryPath: fixtureRegistry, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');

    // Escaped versions must appear — proves esc() ran on each rendered field.
    assert.ok(
      html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
      'expected escaped <script> from name in output',
    );
    assert.ok(
      html.includes('&lt;img src=x onerror=alert(3)&gt;'),
      'expected escaped <img> from category in output',
    );
    assert.ok(
      html.includes('&lt;img src=x onerror=alert(2)&gt;'),
      'expected escaped <img> from proFeatures in output',
    );
    // And the working tags must NOT appear anywhere — XSS leak guard.
    assert.ok(
      !html.includes('<script>alert(1)</script>'),
      'unescaped <script> tag from name leaked into output — XSS vulnerability',
    );
    assert.ok(
      !html.includes('<img src=x onerror=alert(3)>'),
      'unescaped <img> tag from category leaked into output — XSS vulnerability',
    );
    assert.ok(
      !html.includes('<img src=x onerror=alert(2)>'),
      'unescaped <img> tag from proFeatures leaked into output — XSS vulnerability',
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('build.js writes manifest.json with PWA fields', () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'),
    );
    assert.equal(manifest.name, 'ProAppStore');
    assert.equal(manifest.start_url, '/');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
