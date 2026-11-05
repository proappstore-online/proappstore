/* Anonymous runtime projection only. Contract: platform docs/promoter-contributions.md.
 * The v1 public list is complete (no cursor/limit); never use owner standings to fill it.
 */
(function () {
  function parse(body, appId) {
    if (!body || body.version !== 1 || body.app_id !== appId || !Array.isArray(body.contributors) || body.next != null) return null;
    var period = body.period;
    if (!period || ![period.from, period.to].every(function (v) { return v === null || (Number.isSafeInteger(v) && Number.isFinite(new Date(v).getTime())); })) return null;
    if (period.from !== null && period.to !== null && period.from >= period.to) return null;
    var cards = [];
    for (var c of body.contributors) {
      var p = c && c.contributions && c.contributions.promotion;
      var s = p && p.share_of_referred_users;
      if (!c || typeof c.display_name !== 'string' || !c.display_name.trim() ||
          !(c.label === null || typeof c.label === 'string') || !p || p.type !== 'promotion_marketing' || p.recorded !== true ||
          !Number.isSafeInteger(p.confirmed_referrals) || p.confirmed_referrals < 0 || !s ||
          s.numerator !== p.confirmed_referrals || !Number.isSafeInteger(s.denominator) || s.denominator < s.numerator ||
          typeof s.percent !== 'number' || !Number.isFinite(s.percent) || s.percent < 0 || s.percent > 100 ||
          Math.abs(s.percent - (s.denominator === 0 ? 0 : Math.round(s.numerator / s.denominator * 10000) / 100)) > 0.001) return null;
      cards.push({ name: c.display_name, label: c.label, count: p.confirmed_referrals, percent: s.percent });
    }
    return { cards: cards, period: 'Reporting period (UTC): ' +
      (period.from === null ? 'all recorded history' : new Date(period.from).toISOString()) +
      (period.to === null ? ' through now' : ' to ' + new Date(period.to).toISOString() + ' (exclusive)') };
  }

  function init(doc) {
    var section = doc.getElementById('contributors');
    if (!section) return;
    var list = doc.getElementById('contributorsList');
    var status = doc.getElementById('contributorsStatus');
    var period = doc.getElementById('contributorsPeriod');
    var retry = doc.getElementById('contributorsRetry');
    var win = doc.defaultView, generation = 0, controller;
    function clear() { list.replaceChildren(); list.hidden = true; period.textContent = ''; }
    async function load() {
      var current = ++generation;
      if (controller) controller.abort();
      controller = new AbortController();
      var requestController = controller;
      var signal = requestController.signal;
      clear(); retry.hidden = true;
      section.setAttribute('aria-busy', 'true');
      status.textContent = 'Loading public contributors…';
      var appId = section.getAttribute('data-app-id');
      var timer = win.setTimeout(function () { requestController.abort(); }, 12000);
      try {
        if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(appId || '')) throw new Error('context');
        var response = await win.fetch('https://api.proappstore.online/v1/storefront/apps/' + encodeURIComponent(appId) + '/contributors',
          { credentials: 'omit', cache: 'no-store', signal: signal });
        if (current !== generation || section.getAttribute('data-app-id') !== appId) return;
        if (response.status === 404) { status.textContent = 'Public contributors are unavailable for this app.'; return; }
        if (!response.ok) throw new Error('request');
        var result = parse(await response.json(), appId);
        if (current !== generation || section.getAttribute('data-app-id') !== appId) return;
        if (!result) throw new Error('contract');
        period.textContent = result.period;
        result.cards.forEach(function (card) {
          var li = doc.createElement('li');
          li.className = 'contributor-card';
          var name = doc.createElement('strong'); name.textContent = card.name; li.appendChild(name);
          if (card.label) { var label = doc.createElement('p'); label.textContent = card.label; li.appendChild(label); }
          var stats = doc.createElement('p');
          stats.textContent = 'Promotion / Marketing · ' + card.count + ' confirmed referrals · ' + card.percent + '% share among all promoters';
          li.appendChild(stats); list.appendChild(li);
        });
        list.hidden = !result.cards.length;
        status.textContent = result.cards.length ? 'Public contributors who chose to share their promotion contribution.' : 'No public promotion contributors to show for this period.';
      } catch (e) {
        if (current !== generation) return;
        clear(); status.textContent = 'Could not load public contributors. Try again.'; retry.hidden = false;
      } finally {
        win.clearTimeout(timer);
        if (current === generation) section.setAttribute('aria-busy', 'false');
      }
    }
    retry.addEventListener('click', load);
    new win.MutationObserver(load).observe(section, { attributes: true, attributeFilter: ['data-app-id'] });
    win.addEventListener('pagehide', function () { ++generation; if (controller) controller.abort(); clear(); });
    win.addEventListener('pageshow', function (e) { if (e.persisted) load(); });
    load();
  }
  if (typeof module === 'object' && module.exports) { module.exports = { parse: parse }; return; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
})();
