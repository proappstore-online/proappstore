// /ideas - "I'm building this" claims (ProAppStore only).
//
// Fills every `.ideas-claim[data-idea]` slot the shared renderer writes with a
// builder count and a toggle button, from api.proappstore.online. Everything
// stays hidden until the counts load; if the API is down the page is simply
// the static ideas page.
//
// Auth: the console (proappstore.online/app/) mirrors the signed-in session
// token into the `pas_token` cookie on .proappstore.online (console
// web/src/authSync.ts). It is a bearer token, sent as `Authorization: Bearer`;
// the API's CORS allows this origin and the Authorization header, and no
// cookie ever travels cross-origin. A stale token (401) is treated as signed out.
(function () {
  'use strict';

  var slots = Array.prototype.slice.call(document.querySelectorAll('.ideas-claim[data-idea]'));
  if (!slots.length || !window.fetch) return;

  var API = 'https://api.proappstore.online/v1/store';
  var IDEA_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var ERROR_MS = 2500;

  var token = readToken();
  var counts = {};
  var mine = {};

  function readToken() {
    var m = document.cookie.match(/(?:^|; )pas_token=([^;]*)/);
    if (!m || !m[1]) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return null; }
  }

  function request(method, path, withAuth) {
    var headers = {};
    if (withAuth && token) headers.Authorization = 'Bearer ' + token;
    return fetch(API + path, { method: method, headers: headers, credentials: 'omit' }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { status: res.status, ok: res.ok, body: body || {} };
      });
    });
  }

  function signIn(id) {
    // The console signs in and sets pas_token. return_to is where the user
    // should land afterwards; the console does not act on it yet.
    location.href = '/app/?return_to=' + encodeURIComponent('/ideas#idea-' + id);
  }

  function own(map, id) { return Object.prototype.hasOwnProperty.call(map, id); }

  function countText(n) {
    return n === 1 ? '1 person building this' : n + ' people building this';
  }

  function render(slot) {
    var id = slot.getAttribute('data-idea');
    var n = own(counts, id) && typeof counts[id] === 'number' ? counts[id] : 0;
    var isMine = own(mine, id) && mine[id] === true;
    var count = slot.querySelector('.ideas-claim-count');
    if (n > 0) {
      if (!count) {
        count = document.createElement('span');
        count.className = 'ideas-claim-count';
        slot.insertBefore(count, slot.firstChild);
      }
      count.textContent = countText(n);
    } else if (count) {
      slot.removeChild(count);
    }
    var btn = slot.querySelector('.ideas-claim-btn');
    if (!btn.getAttribute('data-error')) {
      btn.textContent = isMine ? 'You\'re building this \u2713' : 'I\'m building this';
    }
    btn.setAttribute('aria-pressed', isMine ? 'true' : 'false');
  }

  function showError(slot, btn, text) {
    btn.setAttribute('data-error', '1');
    btn.textContent = text;
    setTimeout(function () {
      btn.removeAttribute('data-error');
      btn.disabled = false;
      render(slot);
    }, ERROR_MS);
  }

  function toggle(slot, btn) {
    var id = slot.getAttribute('data-idea');
    if (!token) { signIn(id); return; }
    if (btn.disabled) return;
    btn.disabled = true;
    var claiming = !(own(mine, id) && mine[id] === true);
    request(claiming ? 'POST' : 'DELETE', '/ideas/' + encodeURIComponent(id) + '/builder', true).then(function (r) {
      if (r.status === 401) { token = null; signIn(id); return; }
      if (!r.ok) {
        var msg = typeof r.body.error === 'string' && r.body.error.length <= 80 ? r.body.error
          : (r.status === 409 ? 'Too many ideas claimed' : r.status === 429 ? 'Slow down \u2014 try again soon' : 'Something went wrong');
        showError(slot, btn, msg);
        return;
      }
      if (claiming) mine[id] = true; else delete mine[id];
      if (typeof r.body.count === 'number') counts[id] = r.body.count;
      btn.disabled = false;
      render(slot);
    }, function () {
      showError(slot, btn, 'Something went wrong');
    });
  }

  function mount() {
    slots.forEach(function (slot) {
      var id = slot.getAttribute('data-idea');
      if (!IDEA_ID.test(id || '')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ideas-claim-btn';
      btn.addEventListener('click', function () { toggle(slot, btn); });
      slot.appendChild(btn);
      render(slot);
      slot.hidden = false;
    });
  }

  function load(withAuth) {
    return request('GET', '/idea-builders', withAuth).then(function (r) {
      if (r.status === 401 && withAuth) { token = null; return load(false); }
      if (!r.ok || !r.body.builders || typeof r.body.builders !== 'object') throw new Error('idea-builders ' + r.status);
      return r.body;
    });
  }

  load(Boolean(token)).then(function (data) {
    counts = data.builders;
    mine = data.mine && typeof data.mine === 'object' ? data.mine : {};
    mount();
  }, function () { /* leave every slot hidden */ });
})();
