import { readFileSync } from 'node:fs';

const ID = /^[a-z](?:[a-z0-9-]{0,55}[a-z0-9])?$/;
const REVISION = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const ASSET = /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)$/;

function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${name} must be non-empty text of at most ${max} characters`);
  }
  return value.trim();
}

function httpsUrl(value, name) {
  if (value == null) return null;
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an HTTPS URL`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${name} must be an HTTPS URL`);
  return url.href;
}

function asset(value, name) {
  if (typeof value !== 'object' || !value || Array.isArray(value)) throw new Error(`${name} must be an image object`);
  if (!ASSET.test(value.src)) throw new Error(`${name}.src must be a local PNG, JPEG or WebP asset`);
  return { src: value.src, alt: text(value.alt, `${name}.alt`, 180) };
}

function sections(items, name, min, max) {
  if (!Array.isArray(items) || items.length < min || items.length > max) {
    throw new Error(`${name} must have ${min}-${max} items`);
  }
  return items.map((item, index) => ({
    title: text(item?.title, `${name}[${index}].title`, 100),
    body: text(item?.body, `${name}[${index}].body`, 500),
  }));
}

function contrastWithWhite(hex) {
  const components = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = components.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 1.05 / (0.05 + 0.2126 * r + 0.7152 * g + 0.0722 * b);
}

export function validateSnapshot(raw) {
  if (typeof raw !== 'object' || !raw || Array.isArray(raw) || raw.schemaVersion !== 1) {
    throw new Error('expected marketing snapshot schemaVersion 1');
  }
  if (typeof raw.appId !== 'string' || !ID.test(raw.appId) || raw.appId.startsWith('about-')) {
    throw new Error('invalid appId for about- hostname');
  }
  if (typeof raw.revision !== 'string' || !REVISION.test(raw.revision)) throw new Error('invalid revision');
  const appUrl = httpsUrl(raw.appUrl, 'appUrl');
  if (appUrl !== `https://${raw.appId}.proappstore.online/`) {
    throw new Error('appUrl must be the published PAS app origin');
  }
  if (typeof raw.primaryCta !== 'object' || !raw.primaryCta) throw new Error('primaryCta is required');
  if (raw.primaryCta.url !== appUrl) throw new Error('primaryCta.url must open the PAS app');
  const theme = raw.theme ?? {};
  if (typeof theme !== 'object' || Array.isArray(theme) || !HEX.test(theme.accent ?? '#6d28d9')) {
    throw new Error('theme.accent must be a six-digit hex color');
  }
  if (contrastWithWhite(theme.accent ?? '#6d28d9') < 4.5) throw new Error('theme.accent must contrast with white text');
  const screenshots = raw.screenshots ?? [];
  if (!Array.isArray(screenshots) || screenshots.length > 8) throw new Error('screenshots must have at most 8 images');
  return {
    schemaVersion: 1,
    appId: raw.appId,
    revision: raw.revision,
    appUrl,
    name: text(raw.name, 'name', 80),
    headline: text(raw.headline, 'headline', 120),
    summary: text(raw.summary, 'summary', 280),
    benefits: sections(raw.benefits, 'benefits', 3, 8),
    howItWorks: sections(raw.howItWorks, 'howItWorks', 1, 5),
    primaryCta: { label: text(raw.primaryCta.label, 'primaryCta.label', 50), url: appUrl },
    heroImage: raw.heroImage == null ? null : asset(raw.heroImage, 'heroImage'),
    screenshots: screenshots.map((image, index) => asset(image, `screenshots[${index}]`)),
    supportUrl: httpsUrl(raw.supportUrl, 'supportUrl'),
    privacyPolicyUrl: httpsUrl(raw.privacyPolicyUrl, 'privacyPolicyUrl'),
    termsUrl: httpsUrl(raw.termsUrl, 'termsUrl'),
    theme: { accent: theme.accent ?? '#6d28d9' },
  };
}

export function loadSnapshot() {
  const path = process.env.PAS_MARKETING_SNAPSHOT;
  if (!path) throw new Error('PAS_MARKETING_SNAPSHOT is required');
  return validateSnapshot(JSON.parse(readFileSync(path, 'utf8')));
}
