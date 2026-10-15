import { loadSnapshot } from '../../content.mjs';

export function GET() {
  const snapshot = loadSnapshot();
  const preview = process.env.PAS_MARKETING_PREVIEW === '1';
  const location = `https://about-${snapshot.appId}.proappstore.online/`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${preview ? '' : `<url><loc>${location}</loc></url>`}</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
