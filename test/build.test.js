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

// ── Validator + security-regression tests ──

const VALID_APP = {
  id: 'valid-app',
  name: 'Valid',
  category: 'social',
  icon: '&#9728;',
  iconBg: '#f5f3ff',
  description: 'ok',
  appUrl: 'https://valid.proappstore.online',
  repo: 'proappstore-online/valid',
  type: 'connected',
  developer: 'ProAppStore',
};

function runBuildExpectFail(apps) {
  const tmp = makeTmpDir();
  const tmpRegistry = path.join(tmp, 'registry.json');
  fs.writeFileSync(tmpRegistry, JSON.stringify({ apps }));
  try {
    execFileSync(process.execPath, [BUILD_JS], {
      env: { ...process.env, REGISTRY_PATH: tmpRegistry, OUT_DIR: tmp },
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    return { ok: true, stderr: '', tmp };
  } catch (err) {
    return { ok: false, stderr: (err.stderr && err.stderr.toString()) || err.message, tmp };
  }
}

test('validator rejects wrong-host appUrl', () => {
  const { ok, stderr, tmp } = runBuildExpectFail([
    { ...VALID_APP, appUrl: 'https://evil.example.com' },
  ]);
  try {
    assert.equal(ok, false);
    assert.match(stderr, /appUrl must be https:\/\/\*\.proappstore\.online/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('validator rejects bad iconBg', () => {
  const { ok, stderr, tmp } = runBuildExpectFail([
    { ...VALID_APP, iconBg: 'url(javascript:alert(1))' },
  ]);
  try {
    assert.equal(ok, false);
    assert.match(stderr, /iconBg must be a #hex color/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('validator rejects bad id', () => {
  for (const badId of ['UPPER', 'two words', '']) {
    const { ok, tmp } = runBuildExpectFail([{ ...VALID_APP, id: badId }]);
    try {
      assert.equal(ok, false, `id="${badId}" should reject`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('no inline onerror + has data-letter', () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    assert.ok(!/\sonerror\s*=/i.test(html), 'inline onerror= leaked');
    assert.ok(/<div class="app-icon" data-letter="/.test(html), 'data-letter missing');
    // No inline style attribute on app-icon either; iconBg lives in card-styles.css.
    assert.ok(
      !/<div class="app-icon" data-letter="[^"]*" style=/.test(html),
      'inline style= leaked onto .app-icon',
    );
    const css = fs.readFileSync(path.join(tmp, 'card-styles.css'), 'utf8');
    const registry = JSON.parse(fs.readFileSync(REAL_REGISTRY, 'utf8'));
    for (const a of registry.apps) {
      assert.ok(
        css.includes(`.app-card[data-id="${a.id}"] .app-icon`),
        `card-styles.css missing rule for "${a.id}"`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CSP + security headers ship correctly', () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    assert.match(html, /Content-Security-Policy/);
    const headers = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
    assert.match(headers, /X-Frame-Options:\s*DENY/);
    assert.match(headers, /frame-ancestors 'none'/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("style-src is locked too, index.html has zero inline style=", () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const csp = (html.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
    const styleSrc = (csp.match(/style-src[^;]*/) || [''])[0];
    assert.ok(!styleSrc.includes("'unsafe-inline'"), `style-src still 'unsafe-inline': ${styleSrc}`);
    const body = html.replace(/<head>[\s\S]*?<\/head>/, '');
    assert.ok(!/\sstyle="/.test(body), 'inline style= survived in body');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CSP locks index.html script-src with hash (no 'unsafe-inline')", () => {
  const tmp = makeTmpDir();
  try {
    runBuild({ registryPath: REAL_REGISTRY, outDir: tmp });
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const csp = (html.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
    const scriptSrc = (csp.match(/script-src[^;]*/) || [''])[0];
    assert.ok(scriptSrc.includes("'sha256-"), `needs sha256 hash: ${scriptSrc}`);
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), `unsafe-inline leaked: ${scriptSrc}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('validator rejects duplicate ids and unbounded/ctrl-char names', () => {
  let r = runBuildExpectFail([{ ...VALID_APP }, { ...VALID_APP }]);
  try {
    assert.equal(r.ok, false);
    assert.match(r.stderr, /duplicate id/);
  } finally { fs.rmSync(r.tmp, { recursive: true, force: true }); }
  r = runBuildExpectFail([{ ...VALID_APP, name: 'x'.repeat(200) }]);
  try {
    assert.equal(r.ok, false);
    assert.match(r.stderr, /name must be 1-80 chars/);
  } finally { fs.rmSync(r.tmp, { recursive: true, force: true }); }
  r = runBuildExpectFail([{ ...VALID_APP, name: 'tab' + String.fromCharCode(9) + 'name' }]);
  try {
    assert.equal(r.ok, false);
    assert.match(r.stderr, /name must be/);
  } finally { fs.rmSync(r.tmp, { recursive: true, force: true }); }
});

test('detail pages render expected name + escape XSS in description', () => {
  const tmp = makeTmpDir();
  const tmpRegistry = path.join(tmp, 'registry.json');
  try {
    const base = JSON.parse(fs.readFileSync(REAL_REGISTRY, 'utf8'));
    base.apps.push({
      id: 'detail-xss',
      name: 'DetailXSS',
      category: 'social',
      icon: '&#9888;',
      iconBg: '#fff',
      description: '<script>alert(99)</script>',
      appUrl: 'https://detail-xss.proappstore.online',
      repo: 'proappstore-online/detail-xss',
      type: 'connected',
      developer: 'Test',
    });
    fs.writeFileSync(tmpRegistry, JSON.stringify(base));
    runBuild({ registryPath: tmpRegistry, outDir: tmp });
    const detail = fs.readFileSync(path.join(tmp, 'apps', 'detail-xss', 'index.html'), 'utf8');
    // Name renders.
    assert.match(detail, /DetailXSS/);
    // Description's <script> is escaped, never raw.
    assert.ok(detail.includes('&lt;script&gt;alert(99)&lt;/script&gt;'), 'description not escaped on detail');
    assert.ok(!detail.includes('<script>alert(99)</script>'), 'raw <script> leaked on detail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
