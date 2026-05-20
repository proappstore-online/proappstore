/**
 * ProAppStore per-app detail page — fetches the full listing from the API
 * and progressively enhances the static shell rendered by build.js.
 *
 * Reads the app id from a JSON island (<script type="application/json"
 * id="page-data">) so the page is pure-static and CSP stays locked.
 */
(function () {
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

      // Icon — override the build-time placeholder if a real URL is set.
      // We don't write inline style here — splashColor lands on a CSS variable
      // so the rule in style.css can apply it. CSP style-src 'self' is fine.
      if (l.iconUrl) {
        var icon = $("detailIcon");
        if (icon && l.splashColor) icon.style.setProperty("--icon-bg", l.splashColor);
        var img = $("detailIconImg");
        if (img) {
          img.onerror = null;
          img.src = l.iconUrl;
        }
      } else if (l.splashColor) {
        var icon2 = $("detailIcon");
        if (icon2) icon2.style.setProperty("--icon-bg", l.splashColor);
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

      if (l.websiteUrl) { $("websiteLink").href = l.websiteUrl; $("websiteLink").textContent = l.websiteUrl.replace(/^https?:\/\//, ""); show("websiteRow"); }
      if (l.supportUrl) { $("supportLink").href = l.supportUrl; $("supportLink").textContent = l.supportUrl.replace(/^https?:\/\//, ""); show("supportRow"); }

      var socials = [];
      if (l.socialTwitter) socials.push({ label: "𝕏 / Twitter", href: "https://x.com/" + encodeURIComponent(l.socialTwitter), text: "@" + l.socialTwitter });
      if (l.socialGithub) socials.push({ label: "GitHub", href: "https://github.com/" + encodeURIComponent(l.socialGithub), text: l.socialGithub });
      if (l.socialMastodon) socials.push({ label: "Mastodon", href: l.socialMastodon, text: l.socialMastodon.replace(/^https?:\/\//, "") });
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
        show("socialRow");
      }

      if (l.privacyPolicyUrl) { $("privacyLink").href = l.privacyPolicyUrl; show("privacyRow"); }
      if (l.termsUrl) { $("termsLink").href = l.termsUrl; show("termsRow"); }
    })
    .catch(function () { /* leave server-rendered fallback in place */ });
})();
