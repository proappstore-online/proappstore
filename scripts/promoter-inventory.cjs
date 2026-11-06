// Recruitment discovery is narrower than the public app catalogue. Empty is valid.
const URL_BASE = 'https://api.proappstore.online/v1/storefront/promoters/apps';
function parsePage(page) {
  if (!page || !Array.isArray(page.apps) || !('next' in page)) throw new Error('Invalid promoter inventory');
  for (const app of page.apps) if (!app || typeof app.appId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,55}$/.test(app.appId)) throw new Error('Invalid promoter app');
  if (page.next !== null && (!page.next || typeof page.next.after !== 'string' || !page.next.after)) throw new Error('Invalid promoter cursor');
  return page;
}
async function fetchInventory(get = fetch) {
  const apps = [], seen = new Set();
  let after = '';
  for (;;) {
    const url = URL_BASE + '?limit=100' + (after ? '&after=' + encodeURIComponent(after) : '');
    const r = await get(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!r.ok) throw new Error('Promoter inventory HTTP ' + r.status);
    const page = parsePage(await r.json()); apps.push(...page.apps);
    if (!page.next) return { apps, next: null };
    after = page.next.after;
    if (seen.has(after)) throw new Error('Repeated promoter cursor');
    seen.add(after);
  }
}
if (require.main === module) fetchInventory().then(v => process.stdout.write(JSON.stringify(v))).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { parsePage, fetchInventory };
