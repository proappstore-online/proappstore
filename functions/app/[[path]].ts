/**
 * Proxy /app/* to the console CF Pages project.
 *
 * The console SPA is built with `base: './'` (relative), so its HTML
 * references assets as `./assets/...`. When served from /app/, the browser
 * resolves these to /app/assets/..., which this proxy maps back to /assets/...
 * on the console's Pages origin.
 *
 * Flow:
 *   Browser: GET /app/assets/index-abc.js
 *   Proxy:   GET proappstore-console.pages.dev/assets/index-abc.js
 *   Browser: sees proappstore.online as the origin (shared auth)
 */

const CONSOLE_ORIGIN = 'https://proappstore-console.pages.dev';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  // /app/foo → /foo on the console origin
  const path = url.pathname.replace(/^\/app/, '') || '/';
  const target = `${CONSOLE_ORIGIN}${path}${url.search}`;

  const res = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  // SPA fallback: 404 on static assets → serve index.html
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
  // Hashed assets get long cache; everything else gets no-cache
  if (/\.[0-9a-f]{8,}\.(js|css)$/.test(path) || /\.(woff2|png|svg|ico)$/.test(path)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.endsWith('.html') || path === '/') {
    headers.set('Cache-Control', 'no-cache');
  }

  return new Response(res.body, { status: res.status, headers });
};
