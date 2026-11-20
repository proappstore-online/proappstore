# ProAppStore brand

The ProAppStore brand guide lives in the platform repo:
<https://github.com/proappstore-online/platform/blob/main/brand/BRAND.md>. Identity, usage rules and the
update procedure are documented there, not here.

## What this repo carries

Kit version **2026-11-18**. Files are copied byte-for-byte from the kit; do not redraw or re-encode them.

- **Served from the repo root** (8 files): `favicon.svg`, `favicon-16x16.png` (kit `icon-16.png`),
  `favicon-32x32.png` (kit `icon-32.png`), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
  `og-image.png`, `brand.json`.
- **Full export** (17 files), vendored in [`brand/assets/`](brand/assets/).
- **Cache parameter:** pages, templates and `manifest.json` reference the served files with
  `?v=2026-11-18`. Bump it in every reference when the kit version changes; replacing a file at the
  same URL does not refresh browser caches.
