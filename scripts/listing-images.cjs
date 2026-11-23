const FALLBACK = 'https://proappstore.online/icon-512.png';

function ownedUrl(value, base, appUrl, appId) {
  try {
    const url = new URL(value, base);
    const publicUpload = url.origin === 'https://api.proappstore.online' &&
      url.pathname.startsWith(`/v1/apps/${appId || new URL(appUrl).hostname.split('.')[0]}/public/`);
    if (url.protocol !== 'https:' || url.username || url.password ||
        (!publicUpload && ![new URL(appUrl).origin, 'https://proappstore.online'].includes(url.origin))) return null;
    return url.href;
  } catch { return null; }
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(match => [match[1].toLowerCase(), match[2]]));
}

async function enrichListingImages(registry, pages, get = fetch) {
  const images = new Map();
  const load = url => get(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  async function validImage(url) {
    if (!images.has(url)) images.set(url, (async () => {
      try {
        const response = await load(url);
        if (!response.ok || !/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type') || '') ||
            Number(response.headers.get('content-length') || 0) > 2_000_000) return false;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 2_000_000) return false;
        return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
          (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
      } catch { return false; }
    })());
    return images.get(url);
  }
  const apps = [];
  for (const { listingIconUrl, iconUrl: _icon, heroImageUrl: _hero, ...app } of registry.apps) {
    const candidates = [];
    const iconCandidates = [listingIconUrl && ownedUrl(listingIconUrl, app.appUrl, app.appUrl, app.id)];
    if (app.socialImageUrl) {
      const explicit = ownedUrl(app.socialImageUrl, app.appUrl, app.appUrl, app.id);
      if (explicit) candidates.push(explicit);
    }
    const html = pages.get(app.id) || '';
    const manifest = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0]))
      .find(attrs => attrs.rel?.toLowerCase().split(/\s+/).includes('manifest'));
    const manifestUrl = manifest?.href && ownedUrl(manifest.href, app.appUrl, app.appUrl, app.id);
    if (manifestUrl) {
      try {
        const response = await load(manifestUrl);
        if (response.ok) {
          const data = await response.json();
          const icons = Array.isArray(data.icons) ? data.icons.filter(icon => typeof icon.src === 'string') : [];
          icons.sort((a, b) => (Number.parseInt(b.sizes, 10) || 0) - (Number.parseInt(a.sizes, 10) || 0));
          for (const icon of icons.slice(0, 4)) {
            const image = ownedUrl(icon.src, manifestUrl, app.appUrl, app.id);
            if (image) candidates.push(image);
          }
          // A native tile needs a full-bleed square: maskable-only icons carry safe-zone padding.
          for (const icon of icons) {
            const square = String(icon.sizes || '').split(/\s+/).some(size => {
              const match = size.match(/^(\d+)x(\d+)$/i);
              return match && match[1] === match[2] && Number(match[1]) >= 512;
            });
            const purpose = typeof icon.purpose === 'string' ? icon.purpose.toLowerCase().split(/\s+/) : null;
            if (square && (!purpose || purpose.includes('any'))) iconCandidates.push(ownedUrl(icon.src, manifestUrl, app.appUrl, app.id));
          }
        }
      } catch { /* A missing manifest must not turn into a guessed root icon path. */ }
    }
    let socialImageUrl = null;
    for (const candidate of [...new Set([...candidates, FALLBACK])]) {
      if (await validImage(candidate)) { socialImageUrl = candidate; break; }
    }
    if (!socialImageUrl) throw new Error(`${app.id}: no valid owned listing image; refusing broken metadata upload`);
    // The app's own icon, never the store fallback: an absent iconUrl tells a client to draw the emoji.
    let iconUrl = null;
    for (const candidate of new Set(iconCandidates.filter(Boolean))) {
      if (await validImage(candidate)) { iconUrl = candidate; break; }
    }
    const ogImage = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]))
      .find(attrs => attrs.property?.toLowerCase() === 'og:image')?.content;
    let heroImageUrl = ogImage && ownedUrl(ogImage, app.appUrl, app.appUrl, app.id);
    if (heroImageUrl && (heroImageUrl === iconUrl || heroImageUrl === socialImageUrl || !(await validImage(heroImageUrl)))) heroImageUrl = null;
    apps.push({ ...app, ...(iconUrl ? { iconUrl } : {}), socialImageUrl, ...(heroImageUrl ? { heroImageUrl } : {}) });
  }
  return { ...registry, apps };
}

module.exports = { enrichListingImages, FALLBACK, ownedUrl };
