/**
 * Proxy /app/* to the console CF Pages project (proappstore-console.pages.dev).
 * This lets the SPA live at proappstore.online/app/ while being deployed as a
 * separate CF Pages project. The proxy is transparent — the browser sees
 * proappstore.online/app/ as the origin, enabling shared auth (same origin =
 * shared localStorage, cookies, service worker scope).
 *
 * SPA fallback: any path under /app/ that doesn't match a static asset returns
 * the SPA's index.html (standard SPA routing behavior).
 */

const CONSOLE_ORIGIN = 'https://proappstore-console.pages.dev';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  // Strip /app prefix — the console is deployed at the root of its Pages project
  const path = url.pathname.replace(/^\/app\/?/, '/') || '/';
  const proxyUrl = new URL(path, CONSOLE_ORIGIN);
  proxyUrl.search = url.search;

  const res = await fetch(proxyUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  // If the console returned 404 (no matching static asset), serve index.html
  // (SPA fallback — the React router handles client-side routing).
  if (res.status === 404) {
    const fallback = await fetch(new URL('/index.html', CONSOLE_ORIGIN).toString());
    return new Response(fallback.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Pass through with appropriate caching
  const headers = new Headers(res.headers);
  // Static assets (JS/CSS with hashes) get long cache; HTML gets no-cache
  if (path.match(/\.(js|css|woff2|png|svg|ico|webp|json)$/)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    headers.set('Cache-Control', 'no-cache');
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  });
};
