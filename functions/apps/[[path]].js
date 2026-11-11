// Produced by the reconciled build before Pages bundles Functions. This is the
// public deployment snapshot, never the raw provisioning inventory.
import catalogue from '../../catalogue.json';
const published = new Set(catalogue.apps.map(app => app.publicSlug || app.id));

const renamed = new Map(catalogue.apps.filter(app => app.publicSlug && app.publicSlug !== app.id)
  .map(app => [app.id, app.publicSlug]));

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  const match = /^\/apps\/([^/]+)(?:\/index\.html)?\/?$/.exec(path);
  const id = match?.[1];
  if (renamed.has(id) && ['GET', 'HEAD'].includes(context.request.method)) {
    const target = new URL(context.request.url);
    target.pathname = `/apps/${renamed.get(id)}/`;
    return Response.redirect(target.toString(), 301);
  }
  if (!id || !published.has(id)) {
    return new Response(context.request.method === 'HEAD' ? null : 'App listing not found.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' },
    });
  }
  return context.next();
}
