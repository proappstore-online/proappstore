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
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,55}$/;
  var CONSOLE_ORIGIN = "https://console.proappstore.online";
  var APP_PARAM = "app";
  function validId(id) {
    return typeof id === "string" && ID_RE.test(id) && !/[^a-z0-9-]/.test(id);
  }

  // Console entry/return routes only. App context belongs inside the hash.
  // The optional public list constrains caller-supplied and embedded app IDs.
  function buildDestination(base, appId, validIds) {
    function refuse() { throw new RangeError("Invalid Console promoter destination"); }
    if (typeof base !== "string" || !base || base.length > 300) return refuse();
    if (/[\u0000-\u0020\u007f\\]/.test(base)) return refuse();
    if (validId(base)) base = CONSOLE_ORIGIN + "/#/promoter?app=" + base;
    var url;
    try { url = new URL(base); } catch (e) { return refuse(); }
    if (url.origin !== CONSOLE_ORIGIN || url.username || url.password || url.port || url.pathname !== "/" || url.search) return refuse();
    var parts = url.hash.split("?");
    if (parts.length > 2 || (parts[0] !== "#/promoter" && parts[0] !== "#/promoter/return")) return refuse();
    var params = new URLSearchParams(parts[1] || "");
    if (Array.from(params.keys()).some(function (key) { return key !== APP_PARAM; }) || params.getAll(APP_PARAM).length > 1) return refuse();
    var embedded = params.get(APP_PARAM);
    if (embedded !== null && !validId(embedded)) return refuse();
    var id = arguments.length > 1 ? appId : embedded;
    if (id !== null && id !== undefined && id !== "") {
      if (!validId(id) || (validIds !== undefined && (!Array.isArray(validIds) || validIds.indexOf(id) === -1))) return refuse();
    } else {
      id = "";
    }
    url.hash = parts[0] + (id ? "?app=" + id : "");
    return url.href;
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
        try {
          a.setAttribute("href", buildDestination(a.getAttribute("data-destination"), id, ids));
        } catch (e) {
          a.removeAttribute("href");
          a.setAttribute("aria-disabled", "true");
        }
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
    if (requested && validId(requested) && ids.indexOf(requested) !== -1) {
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
