const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../fair-pricing.js');
const base = { direct: 60, shared: 40, others: 999, average: 10, days: 10, cap: 5 };
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);
function conserved(r) { close(r.total, r.cost + r.platform + r.founder + r.team + r.promoter); }
test('equal use funds costs and the complete published reward split', () => {
  const r = calculate(base);
  close(r.total, .2); close(r.cost, .1);
  close(r.platform, .01); close(r.founder, .01); close(r.team, .04); close(r.promoter, .04);
  conserved(r);
});
test('inactive, empty, free and capped cases never create charges or unfunded payouts', () => {
  for (const overrides of [{ days: 0 }, { days: 0, others: 0 }, { direct: 0, shared: 0 }, { cap: 0 }]) {
    const r = calculate({ ...base, ...overrides }); close(r.total, 0); conserved(r);
  }
  const r = calculate({ ...base, cap: .1 });
  close(r.total, .1); close(r.cost, .05); close(r.shortfall, .05); close(r.team, .02); conserved(r);
});
test('empty contribution pool is rebated, including after a cap', () => {
  const r = calculate({ ...base, devWeight: 0, promoWeight: 0 });
  close(r.total, .12); close(r.rebate, .08); close(r.promoter, 0); conserved(r);
  const capped = calculate({ ...base, cap: .1, devWeight: 0, promoWeight: 0 });
  close(capped.total, .06); close(capped.rebate, .04); conserved(capped);
});
test('relative benefit allocations conserve the complete app budget across unequal users', () => {
  const days = [1, 10, 31];
  const rows = days.map((day, i) => calculate({ direct: 60, shared: 40, others: 2,
    average: days.filter((_, j) => j !== i).reduce((a,b) => a+b, 0) / 2, days: day, cap: 1000 }));
  close(rows.reduce((n,r) => n+r.total,0), 200);
  close(rows.reduce((n,r) => n+r.cost,0), 100);
  rows.forEach(conserved);
});
test('one active user owns the entire allocation; invalid numbers fail explicitly', () => {
  close(calculate({ ...base, others: 0, cap: 1000 }).total, 200);
  for (const overrides of [{ direct: NaN }, { shared: Infinity }, { days: -1 }, { days: 32 }, { days: .5 }, { others: .5 }, { average: 0 }]) {
    assert.throws(() => calculate({ ...base, ...overrides }), RangeError);
  }
});

test('the full 80 percent follows contribution weights without changing the user bill', () => {
  for (const [devWeight, promoWeight] of [[3, 1], [0, 1], [1, 0]]) {
    const r = calculate({ ...base, devWeight, promoWeight });
    close(r.total, .2); close(r.team + r.promoter, .08);
    close(r.team, .08 * devWeight / (devWeight + promoWeight)); conserved(r);
  }
  for (const value of [-1, NaN, Infinity]) assert.throws(() => calculate({ ...base, devWeight: value }), RangeError);
});
