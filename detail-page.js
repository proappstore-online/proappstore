/**
 * ProAppStore per-app detail page — fetches the full listing from the API
 * and progressively enhances the static shell rendered by build.js.
 *
 * Reads the app id from a JSON island (<script type="application/json"
 * id="page-data">) so the page is pure-static and CSP stays locked.
 */
(function () {
  function validRef(ref) {
    return typeof ref === "string" && ref.length > 0 && ref.length <= 64 && !/[\s<>\u0026"'\u0000-\u001f\u007f]/.test(ref);
  }

  // Return the original value for invalid codes or unsafe launch destinations.
  function appendRef(href, ref) {
    if (!validRef(ref) || typeof href !== "string" || /[\u0000-\u0020\u007f\\]/.test(href)) return href;
    try {
      var url = new URL(href);
      if (url.protocol !== "https:" || url.username || url.password || url.port) return href;
      url.searchParams.set("ref", ref);
      return url.href;
    } catch (e) { return href; }
  }

  function propagateRef(doc, search) {
    var refs = new URLSearchParams(search).getAll("ref");
    if (refs.length !== 1 || !validRef(refs[0])) return;
    var pageId = doc.querySelector("#team[data-app-id]")?.getAttribute("data-app-id");
    if (!pageId || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(pageId)) return;
    doc.querySelectorAll("a[data-launch-link]").forEach(function (link) {
      var href = link.getAttribute("href");
      try {
        // Never leak a referral to another app, even if markup is misconfigured.
        if (new URL(href).hostname !== pageId + ".proappstore.online") return;
      } catch (e) { return; }
      var updated = appendRef(href, refs[0]);
      if (updated !== href) link.setAttribute("href", updated);
    });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { appendRef: appendRef, propagateRef: propagateRef };
    return;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { propagateRef(document, window.location.search); });
  } else {
    propagateRef(document, window.location.search);
  }

  var APP_ID = "";
  try {
    var raw = document.getElementById("page-data")?.textContent;
    if (raw) APP_ID = (JSON.parse(raw) || {}).id || "";
  } catch (e) {}
  if (!APP_ID) return;

  var API = "https://api.proappstore.online/v1/storefront/apps/" + encodeURIComponent(APP_ID);

  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el && v != null && v !== "") el.textContent = v; }
  function show(id) { var el = $(id); if (el) el.hidden = false; }

  // An icon that fails to load hides, leaving the letter tile (no inline onerror: the CSP blocks it).
  var iconImg = $("detailIconImg");
  if (iconImg) {
    iconImg.addEventListener("error", function () { iconImg.style.display = "none"; });
    iconImg.addEventListener("load", function () { iconImg.style.display = ""; });
    if (iconImg.complete && !iconImg.naturalWidth) iconImg.style.display = "none";
  }

  function renderMarkdownLite(md) {
    // Tiny safe renderer: paragraphs + bold/italic/links. No raw HTML.
    var esc = function (s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
    var html = esc(md)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    var paras = html.split(/\n\s*\n/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br />") + "</p>"; });
    return paras.join("");
  }

  fetch(API, { cache: "default" })
    .then(function (r) { if (!r.ok) throw new Error("listing fetch " + r.status); return r.json(); })
    .then(function (l) {
      if (l.tagline) setText("detailTagline", l.tagline);
      if (l.longDescription) {
        $("detailLongDescription").innerHTML = renderMarkdownLite(l.longDescription);
      }
      if (l.category) setText("detailCategory", l.category);

      // Icon: the page's CSP only loads images from proappstore.online hosts, so an icon
      // anywhere else would replace the build-time image with a broken one.
      var icon = $("detailIcon");
      if (icon && l.splashColor) icon.style.setProperty("--icon-bg", l.splashColor);
      var img = $("detailIconImg");
      if (img && typeof l.iconUrl === "string" && /^https:\/\/([a-z0-9-]+\.)?proappstore\.online\//.test(l.iconUrl)) {
        img.src = l.iconUrl;
      }

      // A verified custom domain is the app's real address: launch there and show it.
      var appOrigin = "https://" + APP_ID + ".proappstore.online";
      if (typeof l.customDomain === "string" && /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(l.customDomain)) {
        appOrigin = "https://" + l.customDomain;
        document.querySelectorAll("a[data-launch-link]").forEach(function (link) {
          var ref = new URL(link.href).searchParams.get("ref");
          link.href = ref ? appendRef(appOrigin + "/", ref) : appOrigin;
          if (link.id === "appLink") link.textContent = l.customDomain;
        });
      }

      if (l.screenshots && l.screenshots.length) {
        var rail = $("screenshotsRail");
        l.screenshots.forEach(function (url) {
          var img = document.createElement("img");
          img.src = url;
          img.alt = "";
          img.loading = "lazy";
          rail.appendChild(img);
        });
        show("screenshotsSection");
      }

      // Only https and mailto leave this page; anything else in a listing is ignored.
      var safe = function (u) { return typeof u === "string" && /^(https:\/\/|mailto:)/.test(u); };
      var info = false;
      // The creator's own website, unless the build already linked a registered one or it is the app itself.
      var site = $("websiteButton");
      if (site && safe(l.websiteUrl) && l.websiteUrl.indexOf("https://") === 0 && new URL(l.websiteUrl).origin !== appOrigin) {
        site.href = l.websiteUrl; site.hidden = false;
        $("websiteLink").href = l.websiteUrl; $("websiteLink").textContent = new URL(l.websiteUrl).host; show("websiteRow");
      }
      if (safe(l.supportUrl)) { $("supportLink").href = l.supportUrl; $("supportLink").textContent = l.supportUrl.replace(/^(https:\/\/|mailto:)/, ""); show("supportRow"); info = true; }

      if (l.permissions && l.permissions.length) {
        var perms = $("permissionsList");
        l.permissions.forEach(function (p) {
          var li = document.createElement("li");
          li.textContent = p.reason ? p.name + ": " + p.reason : p.name;
          perms.appendChild(li);
        });
        show("permissionsSection");
      }

      var socials = [];
      if (l.socialTwitter) socials.push({ label: "𝕏 / Twitter", href: "https://x.com/" + encodeURIComponent(l.socialTwitter), text: "@" + l.socialTwitter });
      if (safe(l.socialMastodon)) socials.push({ label: "Mastodon", href: l.socialMastodon, text: l.socialMastodon.replace(/^https?:\/\//, "") });
      if (l.socialBluesky) socials.push({ label: "Bluesky", href: "https://bsky.app/profile/" + encodeURIComponent(l.socialBluesky), text: "@" + l.socialBluesky });
      if (socials.length) {
        var box = $("socialLinks");
        socials.forEach(function (s, i) {
          if (i > 0) box.appendChild(document.createTextNode(" · "));
          var a = document.createElement("a");
          a.href = s.href; a.target = "_blank"; a.rel = "noopener"; a.textContent = s.text;
          a.setAttribute("title", s.label);
          box.appendChild(a);
        });
        show("socialRow"); info = true;
      }

      if (safe(l.privacyPolicyUrl)) { $("privacyLink").href = l.privacyPolicyUrl; show("privacyRow"); info = true; }
      if (safe(l.termsUrl)) { $("termsLink").href = l.termsUrl; show("termsRow"); info = true; }
      if (info) show("infoSection");
    })
    .catch(function () { /* leave server-rendered fallback in place */ });
})();
