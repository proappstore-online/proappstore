/**
 * ProAppStore /promoters — app selection and promoter-destination handling.
 *
 * The page is fully server-rendered by build.js (app list, CTA state). This
 * script only adds the selected-app context: it validates ?app=<id> against the
 * rendered list, marks the choice, and, when the build marked the promoter
 * destination ready, appends the validated app id to the CTA links. While the
 * destination is unavailable the CTAs stay non-navigating buttons.
 *
 * Also loaded by build.js and tests (CommonJS) for buildDestination().
 */
(function () {
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var STOREFRONT_ORIGIN = "https://proappstore.online";
  var HOST_RE = /^[a-z0-9-]+\.proappstore\.online$/;
  var APP_PARAM = "app"; // provisional until Console #14 fixes the entry contract

  // Returns a safe destination (relative for the storefront origin, absolute for
  // *.proappstore.online), or null when `base` is not an approved destination.
  // `appId` is only attached when it is well formed AND one of `validIds`.
  function buildDestination(base, appId, validIds) {
    if (typeof base !== "string" || base.length === 0 || base.length > 300) return null;
    if (/[\u0000-\u001f\u007f\\]/.test(base)) return null;
    var url;
    try { url = new URL(base, STOREFRONT_ORIGIN); } catch (e) { return null; }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.origin !== STOREFRONT_ORIGIN && !HOST_RE.test(url.hostname)) return null;
    if (url.hash) return null;
    if (typeof appId === "string" && ID_RE.test(appId) && Array.isArray(validIds) && validIds.indexOf(appId) !== -1) {
      url.searchParams.set(APP_PARAM, appId);
    }
    return url.origin === STOREFRONT_ORIGIN ? url.pathname + url.search : url.href;
  }

  function init(doc) {
    var list = doc.getElementById("promoApps");
    if (!list) return;
    var buttons = Array.prototype.slice.call(list.querySelectorAll("button[data-app-id]"));
    var ids = buttons.map(function (b) { return b.getAttribute("data-app-id"); });
    var selectedEl = doc.getElementById("promoSelected");
    var links = Array.prototype.slice.call(doc.querySelectorAll("a.promo-cta[data-destination]"));
    var selected = "";

    function select(id, announce) {
      selected = id;
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-app-id") === id ? "true" : "false");
      });
      var name = "";
      buttons.forEach(function (b) { if (b.getAttribute("data-app-id") === id) name = b.getAttribute("data-app-name") || id; });
      if (selectedEl) {
        selectedEl.textContent = id
          ? "Selected app: " + name + ". It will be kept when promoter sign-in is available."
          : "No app selected. You can choose one now or after signing in.";
      }
      links.forEach(function (a) {
        var dest = buildDestination(a.getAttribute("data-destination"), id, ids);
        if (dest) a.setAttribute("href", dest);
      });
      if (announce && doc.defaultView && doc.defaultView.history && doc.defaultView.history.replaceState) {
        var u = new URL(doc.defaultView.location.href);
        if (id) u.searchParams.set(APP_PARAM, id); else u.searchParams.delete(APP_PARAM);
        doc.defaultView.history.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-app-id");
        select(selected === id ? "" : id, true);
      });
    });

    var requested = new URL(doc.defaultView.location.href).searchParams.get(APP_PARAM);
    var note = doc.getElementById("promoNote");
    if (requested && ID_RE.test(requested) && ids.indexOf(requested) !== -1) {
      select(requested, false);
    } else if (requested && note) {
      note.textContent = "That app is not in the current list, so no app is selected.";
    }
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { buildDestination: buildDestination, ID_RE: ID_RE, APP_PARAM: APP_PARAM };
  } else if (typeof document !== "undefined") {
    init(document);
  }
})();
