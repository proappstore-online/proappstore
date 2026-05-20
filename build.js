const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const REGISTRY_PATH = process.env.REGISTRY_PATH || path.join(ROOT, 'registry.json');
const OUT_DIR = process.env.OUT_DIR || ROOT;
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const apps = registry.apps;

const indexTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'index.html'), 'utf8');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const cards = apps.map((app) => {
  // Escape for safe use inside the single-quoted JS string in img.onerror.
  const letter = (app.name || '?').trim().charAt(0).toUpperCase().replace(/[\\']/g, '\\$&');
  const iconBg = esc(app.iconBg || '#7c3aed');
  const pf = (app.proFeatures || [])
    .slice(0, 3)
    .map((f) => `<span class="pro-badge-sm">${esc(f)}</span>`)
    .join('');
  return `        <div class="app-card compact" data-id="${esc(app.id)}" data-category="${esc(app.category)}">
          <div class="app-icon" style="background: ${iconBg};">
            <img src="${esc(app.appUrl)}/apple-touch-icon.png" alt="" onerror="this.replaceWith(document.createTextNode('${letter}'))" />
          </div>
          <div class="app-body">
            <span class="app-name">${esc(app.name)}</span>
            <span class="app-meta">${esc(app.category)}${pf ? ' · ' + pf : ''}</span>
          </div>
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
  ['Maps + Geocoding', 'Geocode addresses, embed maps, no Google API keys. OpenStreetMap powered.'],
  ['ProShell + Hooks', 'Platform auth gate + subscription wall. ProShell or hooks — you control the UI.'],
];

const featuresHtml = platformFeatures
  .map(([title, body]) => `        <div class="feature-card"><strong>${esc(title)}</strong><p>${esc(body)}</p></div>`)
  .join('\n');

const html = indexTemplate
  .replaceAll('{{APPS_GRID}}', cards)
  .replaceAll('{{FEATURES}}', featuresHtml);

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
console.log(`Built ${apps.length} app cards`);

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
