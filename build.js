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
const header = '<header><div class="container"><a href="/" class="logo">Pro <span>Apps</span></a><nav><a href="/">Apps</a><a href="https://freeappstore.online">Free</a><a href="/pricing">Pricing</a><a href="https://github.com/proappstore-online">GitHub</a></nav></div></header>';
const hero = '<main class="container"><div class="hero"><h1>Pro Apps</h1><p>Premium web apps with subscriptions, real-time collaboration, AI features, and more.</p></div>';
const footer = '</main><footer><div class="container"><div class="footer-left"><a href="/" class="logo">Pro <span>Apps</span></a><p>Premium apps for serious creators.</p></div><div class="footer-links"><a href="https://freeappstore.online">FreeAppStore</a><a href="/pricing">Pricing</a><a href="https://github.com/proappstore-online">GitHub</a></div></div></footer></body></html>';

const html = head + header + hero + '<div class="apps-grid">\n' + cards + '\n</div>' + footer;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('Built ' + apps.length + ' app cards');

fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({name:"ProAppStore",short_name:"ProApps",start_url:"/",display:"standalone",background_color:"#ffffff",theme_color:"#7c3aed",icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]},null,2));
