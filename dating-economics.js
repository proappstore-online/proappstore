/* Illustrative scenario only. Does not bill users or accept investments. */
(function () {
  'use strict';
  function project({ mau, unitCost, overhead = 0, payPercent, sponsor = 0, reserve = 0 }) {
    for (const value of [mau, unitCost, overhead, payPercent, sponsor, reserve]) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError('Use finite, nonnegative values.');
    }
    if (!Number.isInteger(mau) || payPercent > 100) throw new RangeError('Use whole users and a paying share from 0 to 100.');
    const cost = mau * unitCost + overhead;
    const reimbursement = mau ? cost * payPercent / 100 : 0;
    const rewards = reimbursement;
    const revenue = reimbursement + rewards;
    const burn = Math.max(0, cost - reimbursement);
    const subsidy = Math.min(sponsor, burn);
    const gap = burn - subsidy;
    return { cost, revenue, reimbursement, rewards, platform: rewards * .1,
      founder: rewards * .1, contributors: rewards * .8, subsidy, gap,
      runway: gap ? reserve / gap : null };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { project };
  if (typeof document === 'undefined') return;
  const form = document.getElementById('growth-calculator');
  if (!form) return;
  form.addEventListener('submit', event => event.preventDefault());
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function render() {
    const valid = form.checkValidity();
    document.getElementById('growth-error').textContent = valid ? '' : 'Enter valid values in every field.';
    document.getElementById('growth-results').hidden = !valid;
    if (!valid) return;
    const input = {};
    for (const key of ['mau', 'unitCost', 'overhead', 'payPercent', 'sponsor', 'reserve']) input[key] = Number(form.elements[key].value);
    const result = project(input);
    for (const key of ['cost', 'revenue', 'reimbursement', 'platform', 'founder', 'contributors', 'subsidy', 'gap']) {
      document.getElementById('growth-' + key).textContent = money.format(result[key]);
    }
    document.getElementById('growth-runway').textContent = result.runway === null
      ? 'No reserve draw needed for modeled costs'
      : result.runway.toFixed(1) + ' months of reserve at this constant burn rate';
  }
  form.addEventListener('input', render);
  render();
})();
