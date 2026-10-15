import { loadSnapshot } from '../../content.mjs';

export function GET() {
  const snapshot = loadSnapshot();
  const preview = process.env.PAS_MARKETING_PREVIEW === '1';
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: https://about-${snapshot.appId}.proappstore.online/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
