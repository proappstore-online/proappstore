const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateJoin, describeJoinResult, parseMembers, initialOf, LIMITS } = require('../team.js');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_REGISTRY = path.join(__dirname, 'fixtures', 'browser-registry.json');
const TEAM_JS = fs.readFileSync(path.join(ROOT, 'team.js'), 'utf8');

function build(registry = FIXTURE_REGISTRY) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-team-test-'));
  const env = { ...process.env, REGISTRY_PATH: registry, OUT_DIR: out };
  delete env.PUBLIC_INVENTORY; delete env.PUBLIC_INVENTORY_PATH;
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { env, cwd: ROOT, stdio: 'pipe' });
  return out;
}
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const ids = () => JSON.parse(fs.readFileSync(FIXTURE_REGISTRY, 'utf8')).apps.map((a) => a.id);
const teamSection = (html) => html.match(/<section class="app-section team-section"[\s\S]*?<\/section>/)[0];

test('every app detail page has the team section bound to its own app id, with a loaded-by-script SRI hash', () => {
  const out = build();
  try {
    const expected = 'sha256-' + crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'team.js'))).digest('base64');
    for (const id of ids()) {
      const html = read(out, path.join('apps', id, 'index.html'));
      assert.equal((html.match(/id="team"/g) || []).length, 1, id);
      assert.match(html, new RegExp(`<section class="app-section team-section" id="team" data-app-id="${id}" aria-labelledby="teamHeading"`), id);
      assert.match(html, /<h2 id="teamHeading">Team behind this app<\/h2>/);
      assert.ok(html.includes(`<script src="/team.js" integrity="${expected}"></script>`), `${id}: team.js SRI`);
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/, `${id}: unreplaced token`);
      // Still exactly one bare inline script (the theme bootstrap) so the CSP hash story is unchanged.
      assert.equal((html.match(/<script>[\s\S]*?<\/script>/g) || []).length, 1, id);
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the static page makes no claim about who is on the team and cannot submit without script', () => {
  const out = build();
  try {
    const section = teamSection(read(out, 'apps/synthetic-one/index.html'));
    // Hydrated content containers start empty and hidden; the only static prose is neutral.
    assert.match(section, /<ul id="teamList" class="team-list" aria-label="Team members" hidden><\/ul>/);
    assert.match(section, /<p id="teamStatus" class="team-status" role="status" hidden><\/p>/);
    assert.match(section, /<noscript><p class="team-status">The team list and the request form need JavaScript\.<\/p><\/noscript>/);
    assert.doesNotMatch(section, /class="team-member"|team-badge|Creator|Maintainer/);
    // No form target: without script nothing can be posted anywhere.
    const form = section.match(/<form[^>]*>/)[0];
    assert.doesNotMatch(form, /action=|method=/);
    assert.match(form, /novalidate/);
    assert.match(form, /hidden/);
    // Nothing inline: no style attributes, handlers or javascript: URLs.
    assert.doesNotMatch(section, /\sstyle=|\son\w+=|javascript:/i);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('form fields carry the platform limits, labels, autocomplete hints and a hidden honeypot named website', () => {
  const out = build();
  try {
    const section = teamSection(read(out, 'apps/synthetic-two/index.html'));
    assert.match(section, /<input id="teamName" name="name" type="text" maxlength="100" autocomplete="name" required/);
    assert.match(section, /<input id="teamEmail" name="email" type="email" maxlength="254" autocomplete="email" required/);
    assert.match(section, /<textarea id="teamMessage" name="message" rows="4" maxlength="5000" required/);
    for (const field of ['teamName', 'teamEmail', 'teamMessage']) assert.match(section, new RegExp(`<label for="${field}">`));
    assert.equal(LIMITS.name, 100); assert.equal(LIMITS.email, 254); assert.equal(LIMITS.message, 5000);
    const hp = section.match(/<div class="team-hp"[\s\S]*?<\/div>/)[0];
    assert.match(hp, /aria-hidden="true"/);
    assert.match(hp, /name="website"/);
    assert.match(hp, /tabindex="-1"/);
    assert.match(hp, /autocomplete="off"/);
    assert.match(section, /aria-expanded="false" aria-controls="teamJoinForm">Request to join<\/button>/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the registry holds no team roster and the build adds none', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
  for (const app of registry.apps) {
    for (const key of Object.keys(app)) assert.doesNotMatch(key, /^(team|members|contributors|collaborators|roster)$/i, `${app.id}.${key}`);
  }
  const out = build();
  try {
    const catalogue = JSON.parse(read(out, 'catalogue.json'));
    for (const app of catalogue.apps) assert.ok(!('team' in app) && !('members' in app));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('team.js renders API data only as text: no HTML sinks, no eval, no URLs built from the response', () => {
  // Code only: the header comment is allowed to say "no innerHTML".
  const code = TEAM_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(code.length > 3000, 'comment stripping removed too much');
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|setAttribute\(\s*["']href|\.href\s*=|\.src\s*=|srcdoc/);
  assert.match(code, /credentials: "omit"/, 'cross-origin calls must not send credentials');
  assert.match(code, /var API = "https:\/\/api\.proappstore\.online\/v1\/storefront\/apps\/"/);
  // Only the two documented endpoints are used.
  const urls = code.match(/base \+ "[^"]+"/g);
  assert.deepEqual([...new Set(urls)], ['base + "/team"', 'base + "/enquiries/team-join"']);
});

test('validateJoin accepts a normal request and trims it', () => {
  const r = validateJoin({ name: '  Sam Lee ', email: ' sam@example.com ', message: '  I can help with translations.  ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { name: 'Sam Lee', email: 'sam@example.com', message: 'I can help with translations.' });
  assert.deepEqual(r.errors, {});
  // A link is fine in the message (the platform only refuses one in the name).
  assert.equal(validateJoin({ name: 'Sam', email: 'sam@example.com', message: 'My work: https://example.com/portfolio' }).ok, true);
});

test('validateJoin rejects what the platform would refuse, field by field', () => {
  const good = { name: 'Sam', email: 'sam@example.com', message: 'Hello' };
  const bad = (patch) => validateJoin({ ...good, ...patch }).errors;
  assert.ok(validateJoin({}).errors.name && validateJoin({}).errors.email && validateJoin({}).errors.message);
  assert.ok(bad({ name: '   ' }).name);
  assert.ok(bad({ name: 'x'.repeat(101) }).name);
  assert.equal(bad({ name: 'x'.repeat(100) }).name, undefined);
  assert.ok(bad({ name: 'Sam <b>' }).name);
  assert.ok(bad({ name: 'a > b' }).name);
  assert.ok(bad({ name: 'see https://evil.example' }).name);
  assert.ok(bad({ name: 'www.evil.example' }).name);
  assert.ok(bad({ name: 'Sam\u0000' }).name);
  for (const email of ['nope', 'a@b', '@b.co', 'a b@c.co', 'a@b .co', `${'x'.repeat(250)}@b.co`]) assert.ok(bad({ email }).email, email);
  assert.ok(bad({ message: '' }).message);
  assert.ok(bad({ message: 'y'.repeat(5001) }).message);
  assert.equal(bad({ message: 'y'.repeat(5000) }).message, undefined);
  assert.ok(bad({ message: 'hi <script>alert(1)</script>' }).message);
  assert.ok(bad({ message: '<!-- x -->' }).message);
  assert.ok(bad({ message: 'bell\u0007' }).message);
  assert.equal(bad({ message: '1 < 2 and 3 > 2' }).message, undefined, 'bare angle brackets are not markup');
  assert.equal(validateJoin(null).ok, false);
});

test('describeJoinResult maps every API answer and never claims an email or notification was sent', () => {
  const sent = describeJoinResult(201, { ok: true });
  assert.equal(sent.kind, 'sent');
  assert.match(sent.message, /does not make you a member/);
  assert.doesNotMatch(sent.message, /we (have )?(emailed|notified)|notification|push|email (was|has been) sent|has been notified/i);
  // A duplicate answers 201 with no id; the visitor sees the same confirmation.
  assert.equal(describeJoinResult(201, { ok: true }).message, describeJoinResult(201, { ok: true, id: 'abc' }).message);

  assert.equal(describeJoinResult(400, { ok: false, error: 'invalid', detail: 'markup is not allowed' }).kind, 'invalid');
  assert.match(describeJoinResult(400, { detail: 'markup is not allowed' }).message, /markup is not allowed/);
  assert.doesNotMatch(describeJoinResult(400, { detail: 5 }).message, /undefined|\[object/);
  assert.ok(describeJoinResult(400, { detail: 'z'.repeat(500) }).message.length < 250, 'server text is bounded');

  assert.match(describeJoinResult(429, { error: 'rate-limited' }, '3600').message, /about 60 minutes/);
  assert.match(describeJoinResult(429, null, '90').message, /about 2 minutes/);
  assert.match(describeJoinResult(429, null, null).message, /in about an hour/, 'header unreadable cross-origin, so use the fixed 3600 s window');
  assert.equal(describeJoinResult(404).kind, 'closed');
  assert.equal(describeJoinResult(403).kind, 'forbidden');
  for (const status of [0, 413, 415, 500, 502, 503]) {
    const r = describeJoinResult(status);
    assert.equal(r.kind, 'retry', String(status));
    assert.match(r.message, /still here/);
  }
});

test('parseMembers keeps plain display fields only and drops everything else', () => {
  const members = parseMembers({ members: [
    { display_name: 'Ada L.', label: 'Maintainer', is_creator: true, user_id: 'gh:1', email: 'ada@example.com', avatar: 'https://x/y.png', login: 'ada', role: 'admin' },
    { display_name: '  Bo  ', label: '   ', is_creator: 'yes' },
    { display_name: '' }, { display_name: 42 }, null, 'str', { label: 'no name' },
  ] });
  assert.deepEqual(members, [
    { name: 'Ada L.', label: 'Maintainer', creator: true },
    { name: 'Bo', label: '', creator: false },
  ]);
  for (const m of members) assert.deepEqual(Object.keys(m).sort(), ['creator', 'label', 'name']);
  assert.equal(parseMembers({ members: Array.from({ length: 80 }, (_, i) => ({ display_name: `P${i}` })) }).length, 50);
  assert.equal(parseMembers({ members: [{ display_name: 'n'.repeat(200), label: 'l'.repeat(200) }] })[0].name.length, 60);
  assert.equal(parseMembers({ members: [{ display_name: 'n', label: 'l'.repeat(200) }] })[0].label.length, 40);
  assert.deepEqual(parseMembers({ members: [] }), []);
  for (const bad of [null, undefined, {}, [], 'x', { members: 'x' }, { members: {} }]) assert.equal(parseMembers(bad), null);
});

test('initialOf copes with emoji, case and empty names', () => {
  assert.equal(initialOf('ada'), 'A');
  assert.equal(initialOf('  zoe'), 'Z');
  assert.equal(initialOf('🙂 smile'), '🙂');
  assert.equal(initialOf(''), '?');
});
