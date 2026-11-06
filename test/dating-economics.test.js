const test = require('node:test');
const assert = require('node:assert/strict');
const { project } = require('../dating-economics.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('growth scenarios conserve funding and match the published 20-percent payer example', () => {
  for (const mau of [1000, 10000, 100000, 1000000]) {
    const r = project({ mau, unitCost: .05, payPercent: 20 });
    close(r.cost, mau * .05); close(r.revenue, mau * .02); close(r.gap, mau * .04);
    close(r.cost, r.reimbursement + r.subsidy + r.gap);
    close(r.revenue, r.reimbursement + r.platform + r.founder + r.contributors);
  }
});
test('committed subsidy and reserve are distinct and do not double count platform rewards', () => {
  const r = project({ mau: 10000, unitCost: .05, payPercent: 20, sponsor: 100, reserve: 1800 });
  close(r.gap, 300); close(r.runway, 6); close(r.platform, 10);
  close(project({ mau: 1000, unitCost: .05, payPercent: 20, sponsor: 100 }).subsidy, 40);
});
test('free access, full payment, zero users, overhead and no burn are explicit', () => {
  const free = project({ mau: 1000, unitCost: .05, payPercent: 0 });
  close(free.gap, 50); close(free.rewards, 0);
  const paid = project({ mau: 1000, unitCost: .05, payPercent: 100 });
  close(paid.revenue, 100); close(paid.gap, 0); assert.equal(paid.runway, null);
  const empty = project({ mau: 0, unitCost: .05, payPercent: 100, overhead: 100 });
  close(empty.revenue, 0); close(empty.rewards, 0); close(empty.gap, 100);
  close(project({ mau: 1000, unitCost: .05, payPercent: 20, overhead: 50 }).gap, 80);
});
test('invalid or impossible inputs are rejected', () => {
  for (const override of [{ mau: -1 }, { mau: .5 }, { unitCost: NaN }, { reserve: Infinity }, { payPercent: 101 }, { sponsor: -1 }]) {
    assert.throws(() => project({ mau: 1000, unitCost: .05, payPercent: 20, ...override }), RangeError);
  }
});
