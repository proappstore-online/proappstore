const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
const apps = registry.apps;

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const cards = apps.map(app => {
  const pf = (app.proFeatures||[]).map(f => '<span class="pro-badge-sm">'+esc(f)+'</span>').join(' ');
  return '<div class="app-card"><div class="app-card-header"><div class="app-icon" style="background:'+esc(app.iconBg)+'">'+app.icon+'</div><div><h3>'+esc(app.name)+'</h3><div class="tag">'+esc(app.category)+'</div></div></div><p>'+esc(app.description)+'</p>'+(pf?'<div style="margin-bottom:0.75rem;display:flex;gap:0.4rem;flex-wrap:wrap">'+pf+'</div>':'')+'<div class="app-actions"><a href="'+esc(app.appUrl)+'" target="_blank" rel="noopener" class="app-btn-open">Open</a></div></div>';
}).join('\n');

const head = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>ProAppStore \u2014 Premium Web Apps</title><meta name="description" content="Premium web apps with subscriptions, AI, real-time collaboration."/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="apple-touch-icon" href="/apple-touch-icon.png"/><link rel="manifest" href="/manifest.json"/><link rel="stylesheet" href="/style.css"/></head><body>';
const header = '<header><div class="container"><a href="/" class="logo">Pro <span>Apps</span></a><nav><a href="/">Apps</a><a href="https://console.proappstore.online">Console</a><a href="https://dashboard.proappstore.online">Account</a><a href="https://freeappstore.online">Free</a><a href="https://github.com/proappstore-online">GitHub</a></nav></div></header>';
const hero = '<main class="container"><div class="hero"><h1>Pro Apps</h1><p>Premium web apps with subscriptions, real-time collaboration, AI features, and more. One SDK, full power.</p></div>';
const features = '<section style="margin:2rem 0 3rem"><h2 style="font-size:1.3rem;font-weight:800;margin-bottom:1rem">Platform features</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>Per-app SQL Database</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">Full D1 access. Custom schema, indexes, joins. Your own isolated database.</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>Auth (GitHub SSO)</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">Platform-level sign-in. One account across all Pro apps.</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>Real-time Rooms</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">WebSocket fan-out. Chat, presence, multiplayer. No connection limits.</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>Stripe Subscriptions</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">Checkout, billing portal, webhooks. Platform handles all payment flows.</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>Per-user KV + Counters</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">User storage + shared atomic counters for votes, views, leaderboards.</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>File Storage (R2)</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">Upload images, videos, documents. 50MB per file. SDK: app.storage.upload().</p></div>' +
  '<div style="padding:1rem;border:1px solid var(--border);border-radius:0.75rem"><strong>ProShell UI</strong><p style="font-size:0.8rem;color:var(--muted);margin-top:0.25rem">Platform topbar, auth gate, subscription wall. One component, consistent UX.</p></div>' +
  '</div><p style="margin-top:1rem;font-size:0.85rem;color:var(--muted)">All included for $9/month. <a href="https://proappstore.online/skills.md" style="color:var(--accent)">Read the full SDK docs &rarr;</a></p></section>';
const footer = '</main><footer><div class="container"><div class="footer-left"><a href="/" class="logo">Pro <span>Apps</span></a><p>Premium apps for serious creators.</p></div><div class="footer-links"><a href="https://console.proappstore.online">Console</a><a href="https://dashboard.proappstore.online">Account</a><a href="https://freeappstore.online">FreeAppStore</a><a href="https://github.com/proappstore-online">GitHub</a></div></div></footer></body></html>';

const html = head + header + hero + features + '<h2 style="font-size:1.3rem;font-weight:800;margin-bottom:1rem">Apps</h2><div class="apps-grid">\n' + cards + '\n</div>' + footer;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('Built ' + apps.length + ' app cards');

fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({name:"ProAppStore",short_name:"ProApps",start_url:"/",display:"standalone",background_color:"#ffffff",theme_color:"#7c3aed",icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]},null,2));
