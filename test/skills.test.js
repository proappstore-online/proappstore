const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// skills.md is the "AI Agent Guide" served verbatim at /skills.md and by the platform_guide MCP tool.
// Agents follow it literally, so these pin the five statements that went stale (issue #2).
const skills = fs.readFileSync(path.join(__dirname, '..', 'skills.md'), 'utf8');
const lines = skills.split(/\r?\n/);
const lineOf = (needle) => lines.findIndex((l) => l.includes(needle));

test("the issue's acceptance grep finds none of the five stale statements", () => {
  // curl -s https://proappstore.online/skills.md | grep -cE "Max 120 tools|Cron/scheduled \| No \| Coming|No cookies|^app\.auth\.token"
  const stale = lines.filter((l) => /Max 120 tools|Cron\/scheduled \| No \| Coming|No cookies|^app\.auth\.token/.test(l));
  assert.deepEqual(stale, []);
});

test('User type: `name` is the display field, `login` is a deprecated alias, there is no email', () => {
  const user = lines.find((l) => l.includes('The User is:'));
  assert.ok(user, 'User type line missing');
  assert.match(user, /name: string;/);
  assert.match(user, /login: string \/\* deprecated alias of name \*\//);
  assert.match(user, /avatarUrl: string \| null/);
  assert.match(user, /dateOfBirth: string \| null/);
  assert.match(user, /isChild: boolean/);
  assert.doesNotMatch(user, /\bemail\b/);
  assert.match(skills, /There is NO `email`\. Display `user\.name`; key rows by `user\.id`/);
  assert.doesNotMatch(skills, /There is NO `name`/);
  assert.doesNotMatch(skills, /The User is EXACTLY/);
  assert.doesNotMatch(skills, /Use `user\.login` to display/);
});

test('examples display user.name, not the deprecated user.login', () => {
  const displays = lines.filter((l) => /Welcome,/.test(l));
  assert.ok(displays.length >= 2, 'expected the useProAuth and useProGate examples');
  for (const l of displays) {
    assert.match(l, /user\??\.name/, l);
    assert.doesNotMatch(l, /user\??\.login/, l);
  }
});

test('app.auth.token is never presented as an API, only as something not to read', () => {
  assert.equal(lines.filter((l) => /^app\.auth\.token/.test(l)).length, 0);
  assert.doesNotMatch(skills, /Session token \(for API calls\)/);
  const warn = lines.find((l) => l.includes('Never read app.auth.token'));
  assert.ok(warn, 'warning missing');
  assert.match(warn, /null in platform-cookie mode/);
  assert.match(warn, /PAS-AUTH-003/);
  assert.match(warn, /The SDK attaches the session for you/);
  // The warning sits with the auth block, after app.auth.user, not buried elsewhere.
  assert.ok(lineOf('Never read app.auth.token') > lineOf('app.auth.user'));
  assert.ok(lineOf('Never read app.auth.token') - lineOf('app.auth.user') < 10);
});

test('cron/scheduled is documented as shipped, with its real limits', () => {
  const row = lines.find((l) => l.startsWith('| Cron/scheduled'));
  assert.equal(row, '| Cron/scheduled | No | Yes — scheduled registered actions (5 per app, ≥ 5-minute UTC cron) |');
  assert.doesNotMatch(skills, /\|\s*Coming\s*\|/);
});

test('cookies rule: no app cookies, the platform HttpOnly cookie is the only one, state goes in app.kv', () => {
  const rule = lines.find((l) => l.includes('**No app cookies.**'));
  assert.ok(rule, 'cookie rule missing');
  assert.match(rule, /HttpOnly session cookie is the only cookie/);
  assert.match(rule, /do not set your own \(PAS-AUTH-012\)/);
  assert.match(rule, /`app\.kv` \(PAS-STACK-009\)/);
  assert.match(rule, /`localStorage` only for pre-sign-in UI preferences/);
  assert.match(rule, /preferences such as the theme\.$/);
  assert.doesNotMatch(skills, /Use `localStorage` \(via SDK KV\) for persistence/);
  assert.doesNotMatch(skills, /\*\*No cookies\.\*\*/);
});

test('tool cap: 500 per app with a warning from 400, not 120', () => {
  const cap = lines.find((l) => /Max \d+ tools per app/.test(l));
  assert.ok(cap, 'tool cap line missing');
  assert.equal(cap, '- Max 500 tools per app (registration warns from 400). Consolidate near-duplicate list actions with optional filters.');
  assert.doesNotMatch(skills, /\b120 tools\b/);
});

test('the guide is still a single well-formed markdown document with its core sections', () => {
  assert.ok(skills.endsWith('\n'));
  assert.equal((skills.match(/^```/gm) || []).length % 2, 0, 'unbalanced code fences');
  for (const heading of ['## Privacy Rules', '### Platform limits']) assert.ok(skills.includes(heading), heading);
});
