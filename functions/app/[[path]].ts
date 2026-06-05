/**
 * Proxy /app/* to the console CF Pages project.
 *
 * The console SPA is built with `base: './'` (relative), so its HTML
 * references assets as `./assets/...`. For relative paths to resolve correctly,
 * the URL MUST have a trailing slash: /app/ not /app.
 *
 * Flow:
 *   Browser: GET /app/         → proxy fetches console /index.html
 *   Browser: GET /app/assets/x → proxy fetches console /assets/x
 *   Browser: GET /app          → 301 redirect to /app/ (trailing slash)
 */

const CONSOLE_ORIGIN = 'https://proappstore-console.pages.dev';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  // Redirect /app (no trailing slash) to /app/ so relative paths resolve correctly.
  // Without this, ./assets/foo.js resolves to /assets/foo.js instead of /app/assets/foo.js.
  if (url.pathname === '/app') {
    return Response.redirect(`${url.origin}/app/${url.search}${url.hash}`, 301);
  }

  // /app/foo → /foo on the console origin
  const path = url.pathname.replace(/^\/app/, '') || '/';

  // Static assets: don't fallback to index.html (prevents serving HTML as JS/CSS)
  const isAsset = /\.(js|css|json|png|svg|ico|woff2|webp|webmanifest|map|txt)$/.test(path);

  const target = `${CONSOLE_ORIGIN}${path}${url.search}`;
  const res = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  // If it's a real asset and the console returns 404, return 404 (don't serve HTML as JS)
  if (res.status === 404 && isAsset) {
    return new Response('Not Found', { status: 404 });
  }

  // SPA fallback: non-asset 404s serve index.html (hash routing)
  if (res.status === 404) {
    const fallback = await fetch(`${CONSOLE_ORIGIN}/index.html`);
    return new Response(fallback.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const headers = new Headers(res.headers);
  if (/\.[0-9a-f]{8,}\.(js|css)$/.test(path) || /\.(woff2|png|svg|ico)$/.test(path)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.endsWith('.html') || path === '/') {
    headers.set('Cache-Control', 'no-cache');
  }

  return new Response(res.body, { status: res.status, headers });
};
