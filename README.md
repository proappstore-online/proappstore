# ProAppStore storefront

Static storefront for [proappstore.online](https://proappstore.online), built by `build.js`
from `registry.json` and deployed to Cloudflare Pages by `.github/workflows/deploy.yml`.

```
npm ci
npm test               # unit and build tests
npm run test:browser   # mobile Chromium + WebKit (npx playwright install chromium webkit first)
npm run build          # offline build from registry.json
```

## Private apps are never rendered

A private app is reachable only by its team, so it must not appear on the storefront. The
platform API's `https://api.proappstore.online/v1/storefront/apps` lists public apps only.
In production the build drops every `registry.json` app that is not in that list, so a
private app produces no card, no `apps/<id>/` page, no sitemap entry, no `catalogue.json`
row, and no `/promoters` or `/ideas` link. This covers an app that went private after it was
published, and a private app whose first publish landed in `registry.json` before its
manifest registered.

- The deploy build sets `PUBLIC_INVENTORY=live`, which fetches that list at build time
  (`scripts/public-inventory.cjs`). **If the API cannot be read, or returns an empty or
  malformed list, the build fails** instead of listing everything, and nothing is deployed.
  The catalogue reconcile step before it applies the same rule independently.
- A registry entry that declares `"private": true` or `"visibility": "private" | "hidden" | "unlisted"`
  is never rendered, in any build.
- `PUBLIC_INVENTORY_PATH=<file>` reads a saved API response instead (used by tests).
- With neither variable set (a local `npm run build`) only the explicit entry flags apply, so
  local and test builds stay offline and deterministic. Never publish from such a build.

### How long a visibility change takes to reach the storefront

The storefront is rebuilt and redeployed:

| Trigger | When |
| --- | --- |
| `schedule` (hourly, at minute 17) | **At most about one hour** after a flip, plus the build (a few minutes). This is the guaranteed bound. GitHub does not guarantee cron start times, so a busy period can add delay. |
| `repository_dispatch`, type `app-visibility-changed` | **A few minutes**: the deploy starts as soon as the platform sends the event. Optional speed-up; the hourly run is the backstop if it is not sent. |
| any push to `main`, or manual dispatch | immediately |

The platform side of the dispatch is a call to
`POST /repos/proappstore-online/proappstore/dispatches` with
`{"event_type":"app-visibility-changed"}` from the platform, using a token that can write to this
repository. Until the platform sends it, the hourly schedule is what bounds the delay.

Cached copies of a withdrawn detail page cannot outlive a rebuild either: the Pages route in
`functions/apps/[[path]].js` checks the compiled `catalogue.json` and answers 404 with
`no-store` for anything not in it. See `CATALOGUE.md` for how listings are approved.
