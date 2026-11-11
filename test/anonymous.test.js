// The storefront is anonymous (issue #16): no page, sitemap, or public data file may say who built an app.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'browser-registry.json'), 'utf8'));
const UNAVAILABLE = path.join(__dirname, 'fixtures', 'promoter-destination-unavailable.json');

function files(dir, skip = () => false) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (skip(p)) return [];
    return e.isDirectory() ? files(p, skip) : [p];
  });
}

test('developer fields in a registry never reach a generated public file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-anon-'));
  const out = path.join(tmp, 'out');
  fs.mkdirSync(out);
  try {
    const registry = {
      apps: FIXTURE.apps.map((a) => ({ ...a, developer: 'Zed Quillfeather', repo: 'zedquillfeather/secret-repo', creatorGithub: 'zedquillfeather' })),
      developers: [{ id: 'zedq', name: 'Zed Quillfeather', github: 'zedquillfeather', bio: 'Bio about zedq the founder',
        badges: ['founding-developer'], joinedAt: '2026-05-01' }],
    };
    const regPath = path.join(tmp, 'registry.json');
    fs.writeFileSync(regPath, JSON.stringify(registry));
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
      cwd: ROOT, stdio: 'pipe',
      env: { ...process.env, REGISTRY_PATH: regPath, OUT_DIR: out, PROMOTER_DESTINATION_PATH: UNAVAILABLE },
    });
    assert.ok(fs.existsSync(path.join(out, 'index.html')));
    for (const gone of ['developers', 'developers.html']) assert.ok(!fs.existsSync(path.join(out, gone)), `${gone} was generated`);
    const banned = [/Zed Quillfeather/i, /zedquillfeather/i, /secret-repo/i, /Bio about zedq/i, /Founding Dev/i,
      /avatars\.githubusercontent/i, /github\.com\/[\w.-]+\.png/i, /\/developers/i];
    for (const f of files(out)) {
      const text = fs.readFileSync(f, 'utf8');
      for (const re of banned) assert.ok(!re.test(text), `${path.relative(out, f)} matches ${re}`);
    }
    for (const app of JSON.parse(fs.readFileSync(path.join(out, 'catalogue.json'), 'utf8')).apps) {
      assert.ok(!('developer' in app) && !('repo' in app) && !('creatorGithub' in app), `catalogue.json leaks developer/repo/creatorGithub for ${app.id}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('committed public files carry no developer names, avatars, profile links or source links', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
  assert.ok(!('developers' in registry), 'registry.json has a developers[] list');
  for (const a of registry.apps) assert.ok(!('developer' in a) && !('repo' in a) && !('creatorGithub' in a), `registry.json: ${a.id} has developer/repo/creatorGithub`);
  for (const gone of ['developers', 'developers.html', 'templates/developers.html', 'templates/developer-detail.html']) {
    assert.ok(!fs.existsSync(path.join(ROOT, gone)), `${gone} still exists`);
  }
  const top = fs.readdirSync(ROOT).filter((f) => /\.(html|txt|xml|json|js)$/.test(f) && f !== 'package-lock.json' && f !== 'package.json');
  const targets = [...top.map((f) => path.join(ROOT, f)), ...files(path.join(ROOT, 'templates')), ...files(path.join(ROOT, 'apps')), path.join(ROOT, '_headers')];
  for (const f of targets) {
    const text = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.ok(!/avatars\.githubusercontent/.test(text) || rel === 'functions', `${rel} references GitHub avatars`);
    assert.ok(!/github\.com\/[\w.-]+\.png/.test(text), `${rel} loads a GitHub avatar`);
    assert.ok(!/href="\/developers/.test(text), `${rel} links to /developers`);
    if (/\.(html|txt)$/.test(rel) || rel.startsWith('templates')) {
      for (const m of text.matchAll(/(?<![\w.-])github\.com\/([\w.-]+)/g)) {
        assert.equal(m[1], 'proappstore-online', `${rel} links to GitHub profile or repo owner ${m[1]}`);
      }
      assert.ok(!/github\.com\/proappstore-online\/(?!platform\b)[\w.-]+/.test(text), `${rel} links to an app repo`);
    }
  }
  for (const f of files(path.join(ROOT, 'apps'))) {
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!/View source|class="source-link"/.test(text), `${path.relative(ROOT, f)} has a source link`);
  }
});

test('old /developers URLs redirect (301) to the store home', () => {
  const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map((l) => l.trim());
  for (const from of ['/developers', '/developers/*']) assert.ok(redirects.includes(`${from} / 301`), `missing redirect for ${from}`);
});
