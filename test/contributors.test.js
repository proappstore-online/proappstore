const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parse } = require('../contributors');
const fixture = require('./fixtures/contributors.json');
const fresh = () => structuredClone(fixture);
test('public projection keeps server share, duplicate names and reporting period', () => {
  const f = fresh(); f.contributors.push(structuredClone(f.contributors[0]));
  const result = parse(f, f.app_id);
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].percent, 20);
  assert.match(result.period, /all recorded history/);
  f.period = { from: 0, to: 86400000 };
  assert.match(parse(f, f.app_id).period, /1970-01-02.*exclusive/);
});
test('empty and zero-period contributions are valid; malformed/partial responses fail closed', () => {
  const f = fresh(); f.contributors = [];
  assert.deepEqual(parse(f, f.app_id).cards, []);
  const zero = fresh(); const p = zero.contributors[0].contributions.promotion;
  p.confirmed_referrals = 0; Object.assign(p.share_of_referred_users, { numerator: 0, denominator: 0, percent: 0 });
  assert.equal(parse(zero, zero.app_id).cards[0].percent, 0);
  for (const mutate of [f => f.app_id = 'other', f => f.next = { after_id: 'cursor' },
    f => delete f.period, f => f.contributors.push({}), f => f.contributors[0].contributions.promotion.recorded = false,
    f => f.contributors[0].contributions.promotion.share_of_referred_users.percent = '20',
    f => f.contributors[0].contributions.promotion.share_of_referred_users.percent = 100,
    f => f.contributors[0].contributions.promotion.confirmed_referrals = -1]) {
    const f = fresh(); mutate(f); assert.equal(parse(f, 'synthetic-one'), null);
  }
});
test('built app loads contributors with SRI and keeps opportunity/team links', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-contributors-'));
  try {
    execFileSync(process.execPath, ['build.js'], { env: { ...process.env, OUT_DIR: out, REGISTRY_PATH: path.resolve(__dirname, 'fixtures/browser-registry.json') } });
    const html = fs.readFileSync(path.join(out, 'apps/synthetic-one/index.html'), 'utf8');
    const sri = 'sha256-' + crypto.createHash('sha256').update(fs.readFileSync('contributors.js')).digest('base64');
    assert.ok(html.includes('src="/contributors.js" integrity="' + sri + '"'));
    assert.match(html, /id="contributors" data-app-id="synthetic-one"/);
    assert.match(html, /href="#team"/); assert.match(html, /\/promoters\?app=synthetic-one#choose/);
    assert.ok(!html.includes('Synthetic promoter'));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
