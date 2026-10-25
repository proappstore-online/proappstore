const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const { enrichListingImages } = require('./listing-images.cjs');

// Legacy listing rows can predate copy moderation. A repeated-character test
// value must not replace reviewed product copy in cards or the host SEO feed.
function usableTagline(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && !/^(.)\1{11,}$/u.test(text) ? text : null;
}

/** A secondary launch host must not advertise an app-owned canonical elsewhere. */
function hasPrimaryCanonical(html, launchUrl) {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!rel?.split(/\s+/).some(value => value.toLowerCase() === 'canonical')) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!href?.trim()) continue; // The host injects a missing canonical for an approved root.
    try {
      if (new URL(href, launchUrl).href !== launchUrl.href) return false;
    } catch { return false; }
  }
  return true;
}

/** The API is authoritative for public visibility, not copy approval. A row
 * without a curated listing is not permission to publish a draft/internal app. */
async function reconcile(registry, inventory, get = fetch) {
  if (!Array.isArray(inventory.apps) || !inventory.apps.length) throw new Error('Public inventory is empty or invalid; refusing a destructive rebuild');
  const byId = new Map(inventory.apps.map(app => [app.appId, app]));
  const apps = [], excluded = [], pending = [], pages = new Map();
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
    const tagline = usableTagline(live.tagline);
    const sitemapUrl = app.sitemapUrl !== null && hasPrimaryCanonical(html, url) ? new URL('/sitemap.xml', url).href : null;
    apps.push({ ...app, ...(tagline ? { description: tagline } : {}),
      ...((app.socialImageUrl || live.iconUrl) ? { socialImageUrl: app.socialImageUrl || live.iconUrl } : {}), sitemapUrl });
    pages.set(app.id, html);
  }
  const approved = new Set(registry.apps.map(app => app.id));
  for (const app of inventory.apps) if (!approved.has(app.appId)) pending.push({ id: app.appId, reason: 'no approved catalogue copy; keep out of generated discovery' });
  if (!apps.length) throw new Error('No eligible apps; refusing empty catalogue deployment');
  return { registry: { ...registry, apps }, report: { published: apps.map(app => app.id), excluded, pending }, pages };
}

if (require.main === module) (async () => {
  const response = await fetch('https://api.proappstore.online/v1/storefront/apps', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Public inventory HTTP ${response.status}`);
  const result = await reconcile(JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')), await response.json());
  result.registry = await enrichListingImages(result.registry, result.pages);
  const out = process.argv.indexOf('--out');
  if (out < 0 || !process.argv[out + 1]) throw new Error('--out path required');
  fs.writeFileSync(process.argv[out + 1], JSON.stringify(result.registry, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'catalogue-report.json'), JSON.stringify(result.report, null, 2) + '\n');
  console.log(`Catalogue: ${result.registry.apps.length} approved healthy apps, ${result.report.excluded.length} excluded, ${result.report.pending.length} awaiting listing copy`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { reconcile };
