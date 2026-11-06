/* Proposed policy v1. Educational calculator only: no billing or tracking. */
(function () {
  'use strict';
  function calculate({ direct, shared, others, average, days, cap, referred = true }) {
    for (const value of [direct, shared, others, average, days, cap]) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError('Use finite, nonnegative values.');
    }
    if (!Number.isInteger(others) || !Number.isInteger(days) || days > 31 || average < 1 || average > 31) {
      throw new RangeError('Use whole user counts, whole active days from 0 to 31, and an average from 1 to 31.');
    }
    const units = others * average + days;
    const share = units ? days / units : 0;
    const cost = days ? direct / (others + 1) + shared * share : 0;
    const reward = (direct + shared) * share;
    const quoted = cost + reward;
    const factor = quoted ? Math.min(1, cap / quoted) : 0;
    const collectedReward = reward * factor;
    const rebate = referred ? 0 : collectedReward * 0.15;
    return {
      units, share, quoted, cost: cost * factor,
      platform: collectedReward * 0.10,
      founder: collectedReward * 0.15,
      team: collectedReward * 0.60,
      promoter: referred ? collectedReward * 0.15 : 0,
      rebate, shortfall: cost * (1 - factor),
      total: quoted * factor - rebate,
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculate };
  if (typeof document === 'undefined') return;
  const form = document.getElementById('fair-calculator');
  if (!form) return;
  form.addEventListener('submit', event => event.preventDefault());
  function render() {
    const error = document.getElementById('fair-error');
    const results = document.getElementById('fair-results');
    if (!form.checkValidity()) {
      error.textContent = 'Enter valid values in every field to calculate your share.';
      results.hidden = true;
      return;
    }
    const data = {};
    for (const name of ['direct', 'shared', 'others', 'average', 'days', 'cap']) data[name] = Number(form.elements[name].value);
    data.referred = form.elements.referred.checked;
    const result = calculate(data);
    error.textContent = '';
    results.hidden = false;
    for (const name of ['cost', 'platform', 'founder', 'team', 'promoter', 'rebate', 'shortfall']) {
      document.getElementById('fair-' + name).textContent = '$' + result[name].toFixed(4);
    }
    document.getElementById('fair-total').textContent = '$' + (Math.round((result.total + Number.EPSILON) * 100) / 100).toFixed(2);
    document.getElementById('fair-share').textContent = data.days + ' of ' + result.units.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' benefit units · ' + (result.share * 100).toFixed(2) + '% share';
  }
  form.addEventListener('input', render);
  render();
})();
