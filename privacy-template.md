# Privacy Policy — {{APP_NAME}}

_Last updated: {{DATE}}_

This is the privacy policy for **{{APP_NAME}}**, a Pro app on
[ProAppStore](https://proappstore.online). It covers what _this app_ does
with your data. For platform-wide data handling (sign-in, billing, file
storage, usage analytics for creator payouts, account deletion) see the
[platform privacy policy](https://proappstore.online/privacy).

---

## What {{APP_NAME}} stores about you

> _Fill in what your app keeps. Examples below — delete the ones that don't
> apply, add app-specific ones._

- The data you explicitly enter into the app (e.g. notes, photos, contacts).
  Stored in your private per-user KV / database / file storage. No one else
  has access except you.
- _If your app collects more — explicit consent, location, integrations with
  third parties — list each one and why._

## What {{APP_NAME}} does NOT store

- _Examples to keep / edit:_ no contacts list scraping, no background
  location, no microphone access, no analytics on your behavior inside the
  app, no advertising IDs.

## Where data lives

Everything you save in {{APP_NAME}} is stored on Cloudflare infrastructure
(D1, R2, KV) under your ProAppStore account. The app developer does not
have access to your personal data — only daily aggregate counts (active
users, session-minutes, API calls) used to size their payout share.

## Third-party services

> _List any third-party APIs your app calls on the user's behalf — Stripe,
> mapping providers, weather APIs, etc. Delete the section if there are
> none._

- _Example:_ When you geocode an address inside the app, your query is sent
  to OpenStreetMap Nominatim via the platform proxy. The platform strips
  your identity before the request leaves; the third party never sees who
  you are. See [proappstore.online/privacy](https://proappstore.online/privacy#third-party-services)
  for the full list of platform-mediated services.

## Cookies

{{APP_NAME}} uses the same session cookie as the rest of ProAppStore for
authentication. No tracking, advertising, or analytics cookies.

## Data deletion

Delete your account from
[dashboard.proappstore.online](https://dashboard.proappstore.online).
That removes all data {{APP_NAME}} stored for you, alongside the
platform-level account deletion described in the
[platform privacy policy](https://proappstore.online/privacy#data-deletion).

## Contact

Questions about this app's privacy practices: {{CONTACT}}.

Questions about platform-wide privacy: [open an issue on
GitHub](https://github.com/proappstore-online/platform/issues).
