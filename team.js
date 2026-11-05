/**
 * "Team behind this app" and "Request to join" on app detail pages (issue #12, part of platform#541).
 *
 * Reads the platform's public projection and posts a typed team_join enquiry (platform#542,
 * docs/public-team-projection.md):
 *   GET  /v1/storefront/apps/:id/team                    -> { members: [{ display_name, label, is_creator }] }; private/missing: 404
 *   POST /v1/storefront/apps/:id/enquiries/team-join     -> 201 { ok } | 400 { detail } | 403 | 404 | 429 + Retry-After
 *
 * Nothing about the team is baked into the static page, so a withdrawn profile or a publisher
 * transfer cannot leave a stale claim behind. Everything from the API is rendered with
 * textContent; there is no innerHTML and no link built from API data. A request grants no
 * membership, and the page never claims an email or notification was sent.
 *
 * Also loaded by tests (CommonJS) for the pure helpers.
 */
(function () {
  var API = "https://api.proappstore.online/v1/storefront/apps/";
  var APP_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var LIMITS = { name: 100, email: 254, message: 5000 };
  var MAX_MEMBERS = 50;
  var TIMEOUT_MS = 12000;
  // Same shape rules as the platform, so the visitor hears about a problem before a round trip.
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TAGS = /<\/?[a-z!][^>]*>/i;
  var CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  var URLISH = /:\/\/|\bwww\./i;

  function validateJoin(input) {
    var v = {
      name: String(input && input.name != null ? input.name : "").trim(),
      email: String(input && input.email != null ? input.email : "").trim(),
      message: String(input && input.message != null ? input.message : "").trim(),
    };
    var errors = {};
    if (!v.name) errors.name = "Enter your name.";
    else if (v.name.length > LIMITS.name) errors.name = "Keep your name under " + LIMITS.name + " characters.";
    else if (/[<>]/.test(v.name) || TAGS.test(v.name) || CONTROL.test(v.name)) errors.name = "Use plain text in your name.";
    else if (URLISH.test(v.name)) errors.name = "Leave links out of your name.";
    if (!v.email) errors.email = "Enter your email so the team can reply.";
    else if (v.email.length > LIMITS.email || !EMAIL_RE.test(v.email)) errors.email = "Enter a valid email address.";
    else if (TAGS.test(v.email) || CONTROL.test(v.email)) errors.email = "Enter a valid email address.";
    if (!v.message) errors.message = "Write a short message.";
    else if (v.message.length > LIMITS.message) errors.message = "Keep your message under " + LIMITS.message + " characters.";
    else if (TAGS.test(v.message) || CONTROL.test(v.message)) errors.message = "Use plain text in your message (no HTML).";
    return { ok: Object.keys(errors).length === 0, errors: errors, values: v };
  }

  // Maps an API answer to what the visitor is told. `status` 0 = the request never completed.
  function describeJoinResult(status, body, retryAfter) {
    if (status === 201) {
      return { kind: "sent", message: "Request sent. The app's owner will see it in their ProAppStore inbox and may reply to the email you gave. Sending it does not make you a member." };
    }
    if (status === 400) {
      var detail = body && typeof body.detail === "string" ? body.detail.slice(0, 120) : "";
      return { kind: "invalid", message: "The request wasn't accepted" + (detail ? ": " + detail : "") + ". Check your details and try again." };
    }
    if (status === 429) {
      // Browsers hide Retry-After from cross-origin pages unless the API exposes it. The platform always
      // answers 3600 s, so "about an hour" is the right text when the header is not readable.
      var secs = parseInt(retryAfter, 10);
      var when = secs > 0 ? "in about " + Math.max(1, Math.ceil(secs / 60)) + " minutes" : "in about an hour";
      return { kind: "rate", message: "Too many requests have been sent from here. Please try again " + when + "." };
    }
    if (status === 404) return { kind: "closed", message: "This app isn't taking team requests right now." };
    if (status === 403) return { kind: "forbidden", message: "This request can't be sent from this page." };
    return { kind: "retry", message: "Couldn't send your request. Your message is still here, so you can try again." };
  }

  // Only plain-text members are shown; anything malformed is dropped, not repaired.
  function parseMembers(body) {
    if (!body || !Array.isArray(body.members)) return null;
    var out = [];
    for (var i = 0; i < body.members.length && out.length < MAX_MEMBERS; i++) {
      var m = body.members[i];
      if (!m || typeof m.display_name !== "string" || !m.display_name.trim()) continue;
      out.push({
        name: m.display_name.trim().slice(0, 60),
        label: typeof m.label === "string" && m.label.trim() ? m.label.trim().slice(0, 40) : "",
        creator: m.is_creator === true,
      });
    }
    return out;
  }

  function initialOf(name) {
    var first = Array.from(String(name).trim())[0];
    return first ? first.toUpperCase() : "?";
  }

  function init(doc, fetchFn) {
    var section = doc.getElementById("team");
    if (!section) return;
    var appId = section.getAttribute("data-app-id") || "";
    if (!APP_ID_RE.test(appId)) return;
    var win = doc.defaultView;
    var get = fetchFn || (win && win.fetch ? win.fetch.bind(win) : null);
    if (!get) return;
    var base = API + encodeURIComponent(appId);
    var $ = function (id) { return doc.getElementById(id); };
    var els = {
      status: $("teamStatus"), list: $("teamList"), retry: $("teamRetry"), join: $("teamJoin"),
      toggle: $("teamJoinToggle"), form: $("teamJoinForm"), submit: $("teamSubmit"),
      formStatus: $("teamFormStatus"), sent: $("teamSent"), sentText: $("teamSentText"),
      name: $("teamName"), email: $("teamEmail"), message: $("teamMessage"), hp: $("teamWebsite"),
    };
    var setBusy = function (on) { section.setAttribute("aria-busy", on ? "true" : "false"); };
    var show = function (el, on) { if (el) el.hidden = !on; };
    var say = function (text) { if (els.status) { els.status.textContent = text; els.status.hidden = !text; } };

    function withTimeout(url, options) {
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
      var opts = Object.assign({ credentials: "omit", cache: "no-store" }, options || {});
      if (ctl) opts.signal = ctl.signal;
      return get(url, opts).finally(function () { if (timer) clearTimeout(timer); });
    }

    function renderMembers(members) {
      els.list.textContent = "";
      members.forEach(function (m) {
        var li = doc.createElement("li");
        li.className = "team-member";
        var avatar = doc.createElement("span");
        avatar.className = "team-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = initialOf(m.name);
        var text = doc.createElement("span");
        text.className = "team-member-text";
        var name = doc.createElement("span");
        name.className = "team-name";
        name.textContent = m.name;
        text.appendChild(name);
        if (m.creator) {
          var badge = doc.createElement("span");
          badge.className = "team-badge";
          badge.textContent = "Creator";
          text.appendChild(badge);
        }
        if (m.label) {
          var label = doc.createElement("span");
          label.className = "team-label";
          label.textContent = m.label;
          text.appendChild(label);
        }
        li.appendChild(avatar);
        li.appendChild(text);
        els.list.appendChild(li);
      });
    }

    function loadTeam() {
      setBusy(true);
      show(els.retry, false);
      show(els.list, false);
      show(els.join, false);
      say("Loading the team…");
      withTimeout(base + "/team")
        .then(function (r) {
          if (r.status === 404) return { gone: true };
          if (!r.ok) throw new Error("team " + r.status);
          return r.json().then(function (body) { return { members: parseMembers(body) }; });
        })
        .then(function (result) {
          if (result.gone) {
            // Private, delisted or unknown: say as little as the platform does, and offer no form.
            say("Team information isn't available for this app.");
            return;
          }
          if (!result.members) throw new Error("unreadable team");
          if (result.members.length) {
            renderMembers(result.members);
            show(els.list, true);
            say("");
          } else {
            say("No team members have chosen to be listed yet.");
          }
          show(els.join, true);
        })
        .catch(function () {
          say("The team list can't be loaded right now.");
          show(els.retry, true);
        })
        .then(function () { setBusy(false); });
    }

    function fieldError(field, message) {
      var p = $(field.id + "Err");
      if (p) { p.textContent = message || ""; p.hidden = !message; }
      if (message) field.setAttribute("aria-invalid", "true"); else field.removeAttribute("aria-invalid");
    }

    var inFlight = false;
    var done = false;

    els.toggle.addEventListener("click", function () {
      if (done) return;
      var open = els.toggle.getAttribute("aria-expanded") !== "true";
      els.toggle.setAttribute("aria-expanded", open ? "true" : "false");
      show(els.form, open);
      if (open) els.name.focus();
    });

    els.retry.addEventListener("click", loadTeam);

    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (inFlight || done) return;
      var check = validateJoin({ name: els.name.value, email: els.email.value, message: els.message.value });
      fieldError(els.name, check.errors.name);
      fieldError(els.email, check.errors.email);
      fieldError(els.message, check.errors.message);
      if (!check.ok) {
        els.formStatus.textContent = "Please fix the highlighted fields.";
        var firstBad = [els.name, els.email, els.message].filter(function (f) { return f.getAttribute("aria-invalid") === "true"; })[0];
        if (firstBad) firstBad.focus();
        return;
      }
      inFlight = true;
      els.submit.disabled = true;
      els.submit.setAttribute("aria-busy", "true");
      els.formStatus.textContent = "Sending…";
      var payload = { name: check.values.name, email: check.values.email, message: check.values.message };
      if (els.hp && els.hp.value) payload.website = els.hp.value;
      withTimeout(base + "/enquiries/team-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (body) {
            return describeJoinResult(r.status, body, r.headers.get("Retry-After"));
          });
        })
        .catch(function () { return describeJoinResult(0); })
        .then(function (outcome) {
          inFlight = false;
          els.submit.removeAttribute("aria-busy");
          if (outcome.kind === "sent") {
            done = true;
            els.sentText.textContent = outcome.message;
            show(els.form, false);
            show(els.sent, true);
            els.toggle.disabled = true;
            els.sent.focus();
            return;
          }
          // Everything else keeps what was typed so the visitor can retry or correct it.
          els.formStatus.textContent = outcome.message;
          els.submit.disabled = outcome.kind === "closed";
        });
    });

    loadTeam();
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { validateJoin: validateJoin, describeJoinResult: describeJoinResult, parseMembers: parseMembers, initialOf: initialOf, LIMITS: LIMITS };
  } else if (typeof document !== "undefined") {
    init(document);
  }
})();
