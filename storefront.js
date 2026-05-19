/**
 * ProAppStore storefront interactions:
 *   - sort tabs (visual only)
 *   - split-pane preview (load app iframe on ≥1024px)
 *   - ?app=<id> deep link
 *
 * Theme toggle + mobile nav are handled by theme.js so they apply on every page.
 * Vendored — each store ships its own copy.
 */
(function () {
  document.querySelectorAll('.apps-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.apps-tab').forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    });
  });

  var pane = document.getElementById('previewPane');
  if (!pane) return;
  var SPLIT_MQ = window.matchMedia('(min-width: 1024px)');
  var frame = document.getElementById('previewFrame');
  var empty = document.getElementById('previewEmpty');
  var title = document.getElementById('previewTitle');
  var btnNewTab = document.getElementById('previewNewTab');
  var btnClose = document.getElementById('previewClose');
  var current = null;

  function activate(card) {
    document.querySelectorAll('.app-card.compact.is-active').forEach(function (c) {
      c.classList.remove('is-active');
    });
    if (card) card.classList.add('is-active');
  }

  function setTitle(name, url) {
    var host = '';
    try { host = url ? new URL(url).host : ''; } catch (e) {}
    title.innerHTML = '';
    title.appendChild(document.createTextNode(name || 'No app selected'));
    if (host) {
      var hs = document.createElement('span');
      hs.className = 'preview-host';
      hs.textContent = host;
      title.appendChild(hs);
    }
  }

  function setUrlParam(value) {
    try {
      var u = new URL(window.location.href);
      if (value) u.searchParams.set('app', value);
      else u.searchParams.delete('app');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) {}
  }

  function loadInPane(meta, card) {
    current = meta;
    pane.classList.add('is-loading');
    frame.hidden = false;
    empty.hidden = true;
    btnNewTab.hidden = false;
    btnClose.hidden = false;
    setTitle(meta.name, meta.url);
    frame.src = meta.url;
    activate(card);
    frame.addEventListener('load', function once() {
      pane.classList.remove('is-loading');
      frame.removeEventListener('load', once);
    });
    setUrlParam(meta.id);
  }

  function clearPane() {
    current = null;
    frame.removeAttribute('src');
    frame.hidden = true;
    empty.hidden = false;
    btnNewTab.hidden = true;
    btnClose.hidden = true;
    setTitle(null, '');
    activate(null);
    pane.classList.remove('is-loading');
    setUrlParam(null);
  }

  function cardMeta(card) {
    var cta = card.querySelector('.app-cta');
    var name = card.querySelector('.app-name');
    var nameText = 'App';
    if (name) {
      var n = name.firstChild;
      while (n && n.nodeType !== Node.TEXT_NODE) n = n.nextSibling;
      nameText = (n && n.textContent.trim()) || name.textContent.trim();
    }
    return {
      id: card.dataset.id || '',
      name: nameText,
      url: cta ? cta.getAttribute('href') : null,
    };
  }

  document.querySelectorAll('#apps-grid .app-card.compact').forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function (e) {
      if (!SPLIT_MQ.matches) return; // default <a> behavior (new tab)
      e.preventDefault();
      loadInPane(cardMeta(card), card);
    });
  });

  if (btnNewTab) btnNewTab.addEventListener('click', function () {
    if (current && current.url) window.open(current.url, '_blank', 'noopener');
  });
  if (btnClose) btnClose.addEventListener('click', clearPane);

  try {
    var wantId = new URLSearchParams(window.location.search).get('app');
    if (wantId && SPLIT_MQ.matches) {
      var match = document.querySelector('#apps-grid .app-card.compact[data-id="' + CSS.escape(wantId) + '"]');
      if (match) loadInPane(cardMeta(match), match);
    }
  } catch (e) {}

  if (SPLIT_MQ.addEventListener) {
    SPLIT_MQ.addEventListener('change', function (e) { if (!e.matches) activate(null); });
  }
})();
