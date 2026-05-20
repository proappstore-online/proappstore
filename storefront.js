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
  var loadTimeout = null;
  var loadToken = 0;

  var emptyTitleEl = empty && empty.querySelector('.empty-title');
  var emptyTipEl = empty && empty.querySelector('.empty-tip');
  var ORIGINAL_EMPTY_TITLE = emptyTitleEl ? emptyTitleEl.textContent : '';
  var ORIGINAL_EMPTY_TIP_HTML = emptyTipEl ? emptyTipEl.innerHTML : '';

  /* SECURITY: the iframe loads Pro app URLs under *.proappstore.online — all
   * first-party today. Sandbox allows same-origin + scripts because apps need
   * cookies / localStorage / D1 / R2 access. Revisit before opening third-party
   * Pro submissions: an untrusted iframed app currently has full same-origin
   * scope and can read/write its own state without further restriction. */
  function restoreEmpty() {
    if (emptyTitleEl) emptyTitleEl.textContent = ORIGINAL_EMPTY_TITLE;
    if (emptyTipEl) emptyTipEl.innerHTML = ORIGINAL_EMPTY_TIP_HTML;
    if (empty) empty.classList.remove('is-error');
  }

  function showLoadError(meta) {
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
    pane.classList.remove('is-loading');
    frame.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.classList.add('is-error');
      if (emptyTitleEl) emptyTitleEl.textContent = (meta.name || 'This app') + " can't embed here";
      if (emptyTipEl) emptyTipEl.innerHTML = 'It blocks iframes. Click <strong>↗ New tab</strong> to launch it normally.';
    }
  }

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
    restoreEmpty();
    pane.classList.add('is-loading');
    frame.hidden = false;
    empty.hidden = true;
    btnNewTab.hidden = false;
    btnClose.hidden = false;
    setTitle(meta.name, meta.url);
    activate(card);
    setUrlParam(meta.id);

    // Pre-flight reachability — see SECURITY comment above.
    var token = ++loadToken;
    fetch(meta.url, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      .then(function () {
        if (token !== loadToken) return;
        frame.src = meta.url;
        if (loadTimeout) clearTimeout(loadTimeout);
        loadTimeout = setTimeout(function () { showLoadError(meta); }, 10000);
        frame.addEventListener('load', function once() {
          pane.classList.remove('is-loading');
          frame.removeEventListener('load', once);
          if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
        });
      })
      .catch(function () {
        if (token !== loadToken) return;
        showLoadError(meta);
      });
  }

  function clearPane() {
    current = null;
    loadToken++;
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
    frame.removeAttribute('src');
    frame.hidden = true;
    empty.hidden = false;
    restoreEmpty();
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
