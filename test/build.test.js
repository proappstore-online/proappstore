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
    base.apps.push({
      id: 'xss-fixture',
      name: 'XSS Fixture',
      category: 'test',
      icon: '&#9888;',
      iconBg: '#fff',
      description: '<script>alert(1)</script>',
      appUrl: 'https://xss.proappstore.online',
      repo: 'proappstore-online/xss-fixture',
      type: 'connected',
      developer: 'Test',
      proFeatures: ['<img src=x onerror=alert(2)>'],
    });
    fs.writeFileSync(fixtureRegistry, JSON.stringify(base));

    runBuild({ registryPath: fixtureRegistry, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');

    // The literal escaped string must appear — proves esc() ran.
    assert.ok(
      html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
      'expected escaped <script> tag in output',
    );
    // And the working <script>alert(1)</script> tag must NOT appear anywhere.
    assert.ok(
      !html.includes('<script>alert(1)</script>'),
      'unescaped <script> tag leaked into output — XSS vulnerability',
    );
    // proFeatures are also escaped.
    assert.ok(
      html.includes('&lt;img src=x onerror=alert(2)&gt;'),
      'expected escaped <img> tag in proFeatures',
    );
    assert.ok(
      !html.includes('<img src=x onerror=alert(2)>'),
      'unescaped <img> tag leaked from proFeatures',
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
