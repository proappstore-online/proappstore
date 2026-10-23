const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

/** The API is authoritative for public visibility, not copy approval. A row
 * without a curated listing is not permission to publish a draft/internal app. */
async function reconcile(registry, inventory, get = fetch) {
  if (!Array.isArray(inventory.apps) || !inventory.apps.length) throw new Error('Public inventory is empty or invalid; refusing a destructive rebuild');
  const byId = new Map(inventory.apps.map(app => [app.appId, app]));
  const apps = [], excluded = [], pending = [];
  for (const app of registry.apps) {
    if (!byId.has(app.id)) { excluded.push({ id: app.id, reason: 'not in public inventory' }); continue; }
    const url = new URL(app.appUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.proappstore.online') || url.username || url.password) throw new Error(`Invalid approved launch URL: ${app.id}`);
    const response = await get(url.href, { signal: AbortSignal.timeout(20000) });
    if ([404, 410].includes(response.status)) { excluded.push({ id: app.id, reason: `launch HTTP ${response.status}` }); continue; }
    if (!response.ok) throw new Error(`${app.id}: launch HTTP ${response.status}; retry instead of silently delisting a transient outage`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error(`${app.id}: launch is not HTML`);
    const html = await response.text();
    const noindex = /\bnoindex\b/i.test(response.headers.get('x-robots-tag') || '') || [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => /name\s*=\s*["'](?:robots|googlebot)["']/i.test(tag) && /content\s*=\s*["'][^"']*\bnoindex\b/i.test(tag));
    if (noindex) { excluded.push({ id: app.id, reason: 'explicit noindex' }); continue; }
    const live = byId.get(app.id);
    apps.push({ ...app, ...(typeof live.tagline === 'string' && live.tagline.trim() ? { description: live.tagline.trim() } : {}) });
  }
  const approved = new Set(registry.apps.map(app => app.id));
  for (const app of inventory.apps) if (!approved.has(app.appId)) pending.push({ id: app.appId, reason: 'no approved catalogue copy; keep out of generated discovery' });
  if (!apps.length) throw new Error('No eligible apps; refusing empty catalogue deployment');
  return { registry: { ...registry, apps }, report: { published: apps.map(app => app.id), excluded, pending } };
}

if (require.main === module) (async () => {
  const response = await fetch('https://api.proappstore.online/v1/storefront/apps', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Public inventory HTTP ${response.status}`);
  const result = await reconcile(JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')), await response.json());
  const out = process.argv.indexOf('--out');
  if (out < 0 || !process.argv[out + 1]) throw new Error('--out path required');
  fs.writeFileSync(process.argv[out + 1], JSON.stringify(result.registry, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'catalogue-report.json'), JSON.stringify(result.report, null, 2) + '\n');
  console.log(`Catalogue: ${result.registry.apps.length} approved healthy apps, ${result.report.excluded.length} excluded, ${result.report.pending.length} awaiting listing copy`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { reconcile };
