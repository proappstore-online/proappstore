/** Site-wide theme toggle + mobile nav for ProAppStore. Runs on every page.
 *  - Applies stored or system theme (storefront also applies inline in <head> to avoid flash).
 *  - Injects a moon/sun toggle button into the header if one isn't already there.
 *  - Injects mobile hamburger menu + overlay. */

(function () {
  // ── Icon fallback (runs on every page) ──
  function bindIconFallback(img) {
    function fallback() {
      var letter = (img.parentElement && img.parentElement.dataset.letter) || "?";
      img.replaceWith(document.createTextNode(letter));
    }
    if (img.complete && img.naturalHeight === 0) fallback();
    else img.addEventListener("error", fallback, { once: true });
  }
  document.querySelectorAll(".app-icon, .detail-icon").forEach(function (el) {
    var img = el.querySelector("img");
    if (img) bindIconFallback(img);
  });

  // ── Theme: apply stored / preferred mode ──
  try {
    var stored = localStorage.getItem("stores-theme");
    var preferDark = stored === "dark" || (!stored || stored === "system") && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (preferDark) document.documentElement.dataset.theme = "dark";
  } catch (e) {}

  // ── Theme toggle button (skip if storefront already shipped one) ──
  if (!document.getElementById("themeToggle")) {
    var headerC = document.querySelector("header .container");
    if (headerC) {
      var tt = document.createElement("button");
      tt.id = "themeToggle";
      tt.className = "theme-toggle";
      tt.type = "button";
      tt.setAttribute("aria-label", "Toggle dark mode");
      tt.title = "Toggle dark mode";
      tt.innerHTML =
        '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
        '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
      headerC.appendChild(tt);
    }
  }
  // Wire click on whichever toggle ended up in the DOM.
  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn && !themeBtn.dataset.bound) {
    themeBtn.dataset.bound = "1";
    themeBtn.addEventListener("click", function () {
      var isDark = document.documentElement.dataset.theme !== "dark";
      if (isDark) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem("stores-theme", isDark ? "dark" : "light"); } catch (e) {}
    });
  }

  // ── Text-size toggle ──
  (function () {
    var sizes = ['', 'lg', 'sm'];
    var labels = ['A', 'A+', 'A\u2013'];
    var headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    var btn = document.createElement('button');
    btn.className = 'text-size-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Change text size');
    btn.title = 'Change text size';
    function currentIndex() {
      var cur = document.documentElement.dataset.text || '';
      var idx = sizes.indexOf(cur);
      return idx < 0 ? 0 : idx;
    }
    function render() { btn.textContent = labels[currentIndex()]; }
    render();
    btn.addEventListener('click', function () {
      var next = (currentIndex() + 1) % sizes.length;
      if (sizes[next]) {
        document.documentElement.dataset.text = sizes[next];
        try { localStorage.setItem('stores-text-size', sizes[next]); } catch (e) {}
      } else {
        delete document.documentElement.dataset.text;
        try { localStorage.removeItem('stores-text-size'); } catch (e) {}
      }
      render();
    });
    headerRight.insertBefore(btn, headerRight.firstChild);
  })();

  // ── Mobile hamburger menu ──
  var nav = document.querySelector("header nav");
  var headerContainer = document.querySelector("header .container");
  if (nav && headerContainer && !headerContainer.querySelector(".nav-toggle")) {
    var btn = document.createElement("button");
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Menu");
    btn.innerHTML = "&#9776;";
    headerContainer.appendChild(btn);

    var overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);

    var closeBtn = document.createElement("button");
    closeBtn.className = "nav-close";
    closeBtn.setAttribute("aria-label", "Close menu");
    closeBtn.innerHTML = "&#10005;";
    nav.insertBefore(closeBtn, nav.firstChild);

    function openMenu() { nav.classList.add("open"); overlay.classList.add("open"); }
    function closeMenu() { nav.classList.remove("open"); overlay.classList.remove("open"); }

    btn.addEventListener("click", openMenu);
    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);
    nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  }

  // ── Cross-subdomain auth indicator ──
  // Read the pas_token cookie (set by the console after sign-in) to show
  // a signed-in state on the storefront. No API call — just a cookie check.
  (function () {
    var match = document.cookie.match(/(?:^|; )pas_token=([^;]*)/);
    var headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    if (match && match[1]) {
      // Signed in — show Console link
      var link = document.createElement('a');
      link.href = '/app';
      link.className = 'btn-primary';
      link.style.cssText = 'font-size:0.8rem;padding:0.4rem 0.8rem';
      link.textContent = 'Console';
      headerRight.appendChild(link);
    } else {
      // Not signed in — show Sign In button
      var btn = document.createElement('a');
      btn.href = '/app';
      btn.className = 'btn-primary';
      btn.style.cssText = 'font-size:0.8rem;padding:0.4rem 0.8rem';
      btn.textContent = 'Sign In';
      headerRight.appendChild(btn);
    }
  })();
})();
