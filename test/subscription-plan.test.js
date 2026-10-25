const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { subscriptionPlan, jsonLd } = require('../scripts/subscription-plan.cjs');
const source = fs.readFileSync(path.join(__dirname, '../pricing.html'), 'utf8');

test('listing copy and recurring schema read the existing shared subscription source', () => {
  const plan = subscriptionPlan(source);
  assert.equal(plan.label, '$5/mo subscription');
  assert.equal(plan.service.offers.price, '5');
  assert.equal(plan.service.offers.priceSpecification.billingDuration, 'P1M');
  const changed = JSON.parse(JSON.stringify(plan.service));
  changed.offers.price = changed.offers.priceSpecification.price = '7.5';
  const fixture = `<script type="application/ld+json">${JSON.stringify(changed)}</script>`;
  assert.equal(subscriptionPlan(fixture).label, '$7.5/mo subscription');
  changed.offers.priceSpecification.price = '9';
  assert.throws(() => subscriptionPlan(`<script type="application/ld+json">${JSON.stringify(changed)}</script>`), /consistent recurring/);
});

test('native listing schema values survive quotes and cannot terminate the script tag', () => {
  const data = { name: 'A "quoted" <app>', description: '</script>& subscriptions' };
  const serialized = jsonLd(data);
  assert.deepEqual(JSON.parse(serialized), data);
  assert.ok(!serialized.includes('<') && !serialized.includes('&'));
});
