const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname;
const REGISTRY_PATH = process.env.REGISTRY_PATH || path.join(ROOT, 'registry.json');
const OUT_DIR = process.env.OUT_DIR || ROOT;
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const apps = registry.apps;

// Registry shape validator — stop malformed/malicious entries at build time.
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const URL_RE = /^https:\/\/[a-z0-9.-]+\.proappstore\.online(?:\/.*)?$/;
function safeText(s, max) {
  return typeof s === 'string' && s.length > 0 && s.length <= max && !/[\x00-\x1f\x7f]/.test(s);
}
function validateRegistry(items) {
  const errors = [];
  const seenIds = new Set();
  for (const a of items) {
    if (!a.id || !ID_RE.test(a.id)) errors.push(`bad id: ${JSON.stringify(a.id)}`);
    else if (seenIds.has(a.id)) errors.push(`duplicate id: ${JSON.stringify(a.id)}`);
    else seenIds.add(a.id);
    if (!safeText(a.name, 80)) errors.push(`${a.id}: name must be 1-80 chars without control chars`);
    if (!a.appUrl || !URL_RE.test(a.appUrl)) errors.push(`${a.id}: appUrl must be https://*.proappstore.online, got ${JSON.stringify(a.appUrl)}`);
    if (a.iconBg && !COLOR_RE.test(a.iconBg)) errors.push(`${a.id}: iconBg must be a #hex color, got ${JSON.stringify(a.iconBg)}`);
    if (a.category != null && !safeText(a.category, 80)) errors.push(`${a.id}: bad category ${JSON.stringify(a.category)}`);
    if (a.description != null && !safeText(a.description, 500)) errors.push(`${a.id}: description must be 1-500 chars without control chars`);
    if (a.developer != null && !safeText(a.developer, 60)) errors.push(`${a.id}: bad developer ${JSON.stringify(a.developer)}`);
    if (a.proFeatures != null) {
      if (!Array.isArray(a.proFeatures)) errors.push(`${a.id}: proFeatures must be an array`);
      else if (a.proFeatures.length > 8) errors.push(`${a.id}: proFeatures > 8 items`);
      else for (const f of a.proFeatures) if (!safeText(f, 60)) errors.push(`${a.id}: bad proFeature ${JSON.stringify(f)}`);
    }
    if (a.repo != null && (typeof a.repo !== 'string' || a.repo.length > 100 || !/^[\w.-]+\/[\w.-]+$/.test(a.repo))) {
      errors.push(`${a.id}: repo must be "owner/name", got ${JSON.stringify(a.repo)}`);
    }
  }
  if (errors.length) {
    console.error('Registry validation failed:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
}
validateRegistry(apps);

const developers = registry.developers || [];

const indexTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'index.html'), 'utf8');
const detailTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'app-detail.html'), 'utf8');
const developersTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'developers.html'), 'utf8');
const developerDetailTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'developer-detail.html'), 'utf8');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Per-card icon backgrounds live in card-styles.css so a malformed iconBg
// slipping past validation never reaches an HTML style attribute.
function escapeAttrCss(s) { return String(s).replace(/[^a-z0-9_-]/gi, '_'); }
const cardIconBackgrounds = apps
  .map(a => `.app-card[data-id="${escapeAttrCss(a.id)}"] .app-icon { background: ${a.iconBg || '#7c3aed'}; }`)
  .join('\n');

const cards = apps.map((app) => {
  const letter = esc((app.name || '?').trim().charAt(0).toUpperCase());
  const pf = (app.proFeatures || [])
    .slice(0, 3)
    .map((f) => `<span class="pro-badge-sm">${esc(f)}</span>`)
    .join('');
  // Wrap the card body in an anchor to the detail page; keep the "Open" CTA
  // going straight to the live subdomain so users can launch in one click.
  return `        <div class="app-card compact" data-id="${esc(app.id)}" data-category="${esc(app.category)}">
          <a class="app-card-body" href="/apps/${esc(app.id)}/" aria-label="View ${esc(app.name)} details">
            <div class="app-icon" data-letter="${letter}">
              <img src="${esc(app.appUrl)}/apple-touch-icon.png" alt="" loading="lazy" />
            </div>
            <div class="app-body">
              <span class="app-name">${esc(app.name)}</span>
              <span class="app-meta">${esc(app.category)}${pf ? ' · ' + pf : ''}</span>
            </div>
          </a>
          <a href="${esc(app.appUrl)}" target="_blank" rel="noopener" class="app-cta" aria-label="Open ${esc(app.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>
            <span class="cta-label">Open</span>
          </a>
        </div>`;
}).join('\n');

const platformFeatures = [
  ['Per-app SQL Database', 'Full D1 access. Custom schema, indexes, joins. Your own isolated database.'],
  ['Auth (GitHub SSO)', 'Platform-level sign-in. One account across all Pro apps.'],
  ['Real-time Rooms', 'WebSocket fan-out. Chat, presence, multiplayer. No connection limits.'],
  ['Stripe Subscriptions', 'Checkout, billing portal, webhooks. Platform handles all payment flows.'],
  ['Per-user KV + Counters', 'User storage + shared atomic counters for votes, views, leaderboards.'],
  ['File Storage (R2)', 'Upload images, videos, documents. 50 MB per file. SDK: app.storage.upload().'],
  ['Maps + Geocoding + Routing', 'Geocode addresses, driving directions, embed maps. OpenStreetMap powered, no Google keys.'],
  ['Push Notifications', 'Web Push via VAPID. Subscribe users, send targeted or broadcast pushes.'],
  ['SMS', 'Twilio-backed text messages. Send reminders, confirmations, broadcasts. Creator-only.'],
  ['Server-side AI', 'Workers AI text generation, chat, and embeddings. Two model tiers, included in subscription.'],
  ['ProShell + Hooks', 'Platform auth gate + subscription wall. ProShell or hooks — you control the UI.'],
];

const featuresHtml = platformFeatures
  .map(([title, body]) => `        <div class="feature-card"><strong>${esc(title)}</strong><p>${esc(body)}</p></div>`)
  .join('\n');

// SHA-256 of the inline no-flash theme bootstrap so the index CSP can
// whitelist it without 'unsafe-inline'. Detail pages keep 'unsafe-inline'
// because they have a second inline <script> with per-app template data
// (an external-script + JSON-island refactor is a follow-up).
const inlineScriptMatch = indexTemplate.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/);
if (!inlineScriptMatch) {
  console.error('Could not locate the inline bootstrap <script> for CSP hashing');
  process.exit(1);
}
const inlineScriptHash = 'sha256-' + crypto.createHash('sha256').update(inlineScriptMatch[1]).digest('base64');

// SRI hashes for local scripts (CDN/repo tamper defense).
function sriHash(filename) {
  const content = fs.readFileSync(path.join(ROOT, filename));
  return 'sha256-' + crypto.createHash('sha256').update(content).digest('base64');
}
const sriHashes = {
  STOREFRONT_JS: sriHash('storefront.js'),
  THEME_JS: sriHash('theme.js'),
  DETAIL_PAGE_JS: sriHash('detail-page.js'),
  PRISM_JS: sriHash('prism.js'),
  PRISM_AUTODETECT_JS: sriHash('prism-autodetect.js'),
};

let html = indexTemplate
  .replaceAll('{{INLINE_SCRIPT_HASH}}', inlineScriptHash)
  .replaceAll('{{APPS_GRID}}', cards)
  .replaceAll('{{FEATURES}}', featuresHtml);
for (const [k, v] of Object.entries(sriHashes)) {
  html = html.replaceAll(`{{SRI_${k}}}`, v);
}

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
fs.writeFileSync(path.join(OUT_DIR, 'card-styles.css'), cardIconBackgrounds + '\n');
console.log(`Built ${apps.length} app cards`);

// Security headers via CF Pages _headers — single source of truth for CSP and
// every other security header. <meta> CSP intentionally absent.
const csp = [
  "default-src 'self'",
  "img-src 'self' https://*.proappstore.online https://github.com https://avatars.githubusercontent.com data:",
  `script-src 'self' '${inlineScriptHash}'`,
  "style-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://*.proappstore.online https://api.proappstore.online",
  "frame-src https://*.proappstore.online",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.proappstore.online",
  "object-src 'none'",
  "upgrade-insecure-requests",
  // CSP3 reporting + back-compat directive.
  "report-to csp-endpoint",
  "report-uri /v1/csp-report",
].join('; ');

fs.writeFileSync(path.join(OUT_DIR, '_headers'), [
  '/*',
  '  X-Frame-Options: DENY',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
  '  Cross-Origin-Opener-Policy: same-origin',
  '  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), midi=()',
  '  Reporting-Endpoints: csp-endpoint="/v1/csp-report"',
  `  Content-Security-Policy: ${csp}`,
  `  Content-Security-Policy-Report-Only: ${csp}`,
  '',
].join('\n'));

// Per-app detail pages at /apps/{id}/. Each page is a static shell that
// inlines the registry-known fields (name, category, dev, etc.) and then
// progressively enhances client-side by fetching the listing JSON from
// the PAS API. That way the page is meaningful even before the live
// fetch completes — and CDN-cacheable.
const appsDir = path.join(OUT_DIR, 'apps');
fs.mkdirSync(appsDir, { recursive: true });
for (const app of apps) {
  const dir = path.join(appsDir, app.id);
  fs.mkdirSync(dir, { recursive: true });
  const firstLetter = (app.name || '?').trim().charAt(0).toUpperCase().replace(/[\\']/g, '\\$&');
  const appHost = (() => {
    try { return new URL(app.appUrl).host; } catch { return app.appUrl; }
  })();
  const repoUrl = app.repo ? `https://github.com/${app.repo}` : 'https://github.com/proappstore-online';
  const proFeaturesHtml = (app.proFeatures || [])
    .map((f) => `<div class="pro-feature-card"><span class="pro-feature-check">+</span> ${esc(f)}</div>`)
    .join('\n        ');
  // Look up developer info from the developers array
  const dev = developers.find(d => d.name === app.developer) || {};
  const devGithub = dev.github || 'proappstore-online';
  const devUrl = dev.id ? `/developers/${dev.id}/` : '/developers';
  const devBio = dev.bio || '';
  let detail = detailTemplate
    .replaceAll('{{ID}}', esc(app.id))
    .replaceAll('{{NAME}}', esc(app.name))
    .replaceAll('{{DESCRIPTION}}', esc(app.description || ''))
    .replaceAll('{{CATEGORY}}', esc(app.category || ''))
    .replaceAll('{{DEVELOPER}}', esc(app.developer || 'ProAppStore'))
    .replaceAll('{{DEV_GITHUB}}', esc(devGithub))
    .replaceAll('{{DEV_URL}}', esc(devUrl))
    .replaceAll('{{DEV_BIO}}', esc(devBio))
    .replaceAll('{{ICON_BG}}', esc(app.iconBg || '#7c3aed'))
    .replaceAll('{{FIRST_LETTER}}', firstLetter)
    .replaceAll('{{APP_URL}}', esc(app.appUrl))
    .replaceAll('{{APP_HOST}}', esc(appHost))
    .replaceAll('{{REPO_URL}}', esc(repoUrl))
    .replaceAll('{{PRO_FEATURES_HTML}}', proFeaturesHtml || '<div class="pro-feature-card">Premium features included</div>');
  for (const [k, v] of Object.entries(sriHashes)) {
    detail = detail.replaceAll(`{{SRI_${k}}}`, v);
  }
  fs.writeFileSync(path.join(dir, 'index.html'), detail);
}
console.log(`Built ${apps.length} app detail pages under apps/`);

// --- Developer pages ---
// Build a mapping from developer name -> apps
const devAppMap = {};
for (const dev of developers) {
  devAppMap[dev.name] = apps.filter(a => a.developer === dev.name);
}

// Badge labels
const badgeLabels = {
  'platform': 'Platform',
  'founding-developer': 'Founding Dev',
};

// Developer card for the grid
const devCards = developers.map(dev => {
  const appCount = (devAppMap[dev.name] || []).length;
  const badgesHtml = (dev.badges || [])
    .map(b => `<span class="dev-badge ${esc(b)}">${esc(badgeLabels[b] || b)}</span>`)
    .join('');
  return `        <a class="dev-card" href="/developers/${esc(dev.id)}/">
          <img class="dev-avatar" src="https://github.com/${esc(dev.github)}.png?size=200" alt="${esc(dev.name)}" loading="lazy" />
          <div class="dev-card-body">
            <span class="dev-card-name">${esc(dev.name)}</span>
            <span class="dev-card-bio">${esc(dev.bio || '')}</span>
            <div class="dev-badges">${badgesHtml}</div>
            <span class="dev-card-stats">${appCount} app${appCount === 1 ? '' : 's'}</span>
          </div>
        </a>`;
}).join('\n');

let developersHtml = developersTemplate
  .replaceAll('{{DEVELOPERS_GRID}}', devCards);
for (const [k, v] of Object.entries(sriHashes)) {
  developersHtml = developersHtml.replaceAll(`{{SRI_${k}}}`, v);
}
fs.writeFileSync(path.join(OUT_DIR, 'developers.html'), developersHtml);
console.log(`Built developers page (${developers.length} developers)`);

// Per-developer detail pages at /developers/{id}/
const devsDir = path.join(OUT_DIR, 'developers');
fs.mkdirSync(devsDir, { recursive: true });
for (const dev of developers) {
  const dir = path.join(devsDir, dev.id);
  fs.mkdirSync(dir, { recursive: true });
  const devApps = devAppMap[dev.name] || [];
  const appCount = devApps.length;
  // Reuse the compact card markup from the main page
  const devAppsHtml = devApps.map(app => {
    const letter = esc((app.name || '?').trim().charAt(0).toUpperCase());
    const pf = (app.proFeatures || [])
      .slice(0, 3)
      .map(f => `<span class="pro-badge-sm">${esc(f)}</span>`)
      .join('');
    return `        <div class="app-card compact" data-id="${esc(app.id)}" data-category="${esc(app.category)}">
          <a class="app-card-body" href="/apps/${esc(app.id)}/" aria-label="View ${esc(app.name)} details">
            <div class="app-icon" data-letter="${letter}">
              <img src="${esc(app.appUrl)}/apple-touch-icon.png" alt="" loading="lazy" />
            </div>
            <div class="app-body">
              <span class="app-name">${esc(app.name)}</span>
              <span class="app-meta">${esc(app.category)}${pf ? ' · ' + pf : ''}</span>
            </div>
          </a>
          <a href="${esc(app.appUrl)}" target="_blank" rel="noopener" class="app-cta" aria-label="Open ${esc(app.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>
            <span class="cta-label">Open</span>
          </a>
        </div>`;
  }).join('\n');

  const badgesHtml = (dev.badges || [])
    .map(b => `<span class="dev-badge ${esc(b)}">${esc(badgeLabels[b] || b)}</span>`)
    .join('');

  const joinedDate = dev.joinedAt
    ? new Date(dev.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '';

  let detail = developerDetailTemplate
    .replaceAll('{{ID}}', esc(dev.id))
    .replaceAll('{{NAME}}', esc(dev.name))
    .replaceAll('{{BIO}}', esc(dev.bio || ''))
    .replaceAll('{{GITHUB}}', esc(dev.github))
    .replaceAll('{{BADGES_HTML}}', badgesHtml)
    .replaceAll('{{JOINED}}', esc(joinedDate))
    .replaceAll('{{APP_COUNT}}', String(appCount))
    .replaceAll('{{APP_COUNT_PLURAL}}', appCount === 1 ? '' : 's')
    .replaceAll('{{DEV_APPS_GRID}}', devAppsHtml);
  for (const [k, v] of Object.entries(sriHashes)) {
    detail = detail.replaceAll(`{{SRI_${k}}}`, v);
  }
  fs.writeFileSync(path.join(dir, 'index.html'), detail);
}
console.log(`Built ${developers.length} developer detail pages under developers/`);

fs.writeFileSync(
  path.join(OUT_DIR, 'manifest.json'),
  JSON.stringify(
    {
      name: 'ProAppStore',
      short_name: 'ProApps',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#7c3aed',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ),
);

// --- Generate sitemap.xml ---
// Lists every top-level marketing page + every per-app detail page so Google
// can discover them all from one URL. Linked from robots.txt.
const today = new Date().toISOString().split('T')[0];
const sitemapEntries = [
  '  <url><loc>https://proappstore.online/</loc><priority>1.0</priority></url>',
  '  <url><loc>https://proappstore.online/about</loc><priority>0.8</priority></url>',
  '  <url><loc>https://proappstore.online/pricing</loc><priority>0.9</priority></url>',
  '  <url><loc>https://proappstore.online/get-started</loc><priority>0.9</priority></url>',
  '  <url><loc>https://proappstore.online/build-with-ai</loc><priority>0.85</priority></url>',
  '  <url><loc>https://proappstore.online/guidelines</loc><priority>0.7</priority></url>',
  '  <url><loc>https://proappstore.online/docs</loc><priority>0.8</priority></url>',
  '  <url><loc>https://proappstore.online/docs/ui</loc><priority>0.8</priority></url>',
  '  <url><loc>https://proappstore.online/roadmap</loc><priority>0.7</priority></url>',
  '  <url><loc>https://proappstore.online/privacy</loc><priority>0.5</priority></url>',
  '  <url><loc>https://proappstore.online/terms</loc><priority>0.5</priority></url>',
  '  <url><loc>https://proappstore.online/developers</loc><priority>0.8</priority></url>',
  ...developers.map((dev) =>
    `  <url><loc>https://proappstore.online/developers/${dev.id}/</loc><priority>0.7</priority></url>`,
  ),
  ...apps.map((app) =>
    `  <url><loc>https://proappstore.online/apps/${app.id}/</loc><priority>0.9</priority></url>`,
  ),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemap);
console.log(`Generated sitemap.xml (${sitemapEntries.length} URLs)`);
