/** Site-wide theme toggle + mobile nav for ProAppStore. Runs on every page.
 *  - Applies stored or system theme (storefront also applies inline in <head> to avoid flash).
 *  - Injects a moon/sun toggle button into the header if one isn't already there.
 *  - Injects mobile hamburger menu + overlay. */

(function () {
  // ── Theme: apply stored / preferred mode ──
  try {
    var stored = localStorage.getItem("pas-theme");
    var preferDark = stored ? stored === "dark"
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (preferDark) document.documentElement.classList.add("dark");
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
      var isDark = document.documentElement.classList.toggle("dark");
      try { localStorage.setItem("pas-theme", isDark ? "dark" : "light"); } catch (e) {}
    });
  }

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
})();
