# Public catalogue

`registry.json` contains approved listing copy, not the provisioning inventory.
Production builds reconcile it with the current public API inventory and live
launch pages. Only approved entries still public, returning HTML successfully,
and allowing indexing (or explicitly approved for a separate workspace listing) enter the homepage, detail pages, sitemap and
`catalogue.json`. A new API row alone never publishes an internal tool or fixture.

Four reviewed real apps now have catalogue copy: TradePort, Bookkeeper, QueueFlow
and Comps. Their descriptions come from their existing app documentation.
Carsads migrated away from its old PAS origin; Studio has no live PAS origin;
the old Codex smoke app is a test fixture. Those stale entries are no longer listed.

Deployment runs on source changes, manual dispatch and hourly. It removes obsolete
generated detail directories and publishes the reconciled public registry. A
404/410 or unapproved noindex omits a listing; an API outage, timeout or temporary
launch error aborts deployment rather than silently removing healthy apps.
`catalogue-report.json` distinguishes excluded entries from API records awaiting
approved listing copy. Complete and review that copy before adding those entries
to the source catalogue. Visibility/unpublishing changes reconcile within an hour.
`build.js` also re-reads the public inventory itself (`PUBLIC_INVENTORY=live` in deployment) and
fails closed, so a private app cannot render even if it slipped into the reconciled registry.
See README.md for the rebuild triggers and the stated flip-to-storefront time.

Local builds/tests remain deterministic. To build the current public inventory:

```
node scripts/reconcile-catalogue.cjs --out .catalogue-build.json
REGISTRY_PATH=.catalogue-build.json npm run build
```

## Fields

- `socialImageUrl`: validated image used for social cards and storefront tiles. Always present
  (store logo when the app has none).
- `iconUrl`: the app's own square icon (creator upload, or manifest icon of at least 512 px with
  purpose `any`). Absent when the app has none. Clients then draw `icon` (an emoji, possibly an
  HTML entity) on `iconBg`.
- `heroImageUrl`: the app's own `og:image` when it is a distinct, validated image. Absent otherwise.

All three must be on the app's launch origin, the store origin, or the app's own public-upload
path on the API; `build.js` refuses a registry that names any other host.

The Pages detail route checks the compiled `catalogue.json` before serving a
static listing. This prevents cached copies of withdrawn/fixture/private detail
pages surviving a catalogue rebuild. Missing entries return 404 with no-store
and noindex; eligible detail pages keep normal Pages behavior.

## October 2026 inventory review

Tradies, Stash and Leads have reviewed public product copy from their current
application READMEs and healthy public launch pages. They join the approved
catalogue. This advertises the products, not their private quotes, pocket
memberships, addresses, contact records or workspaces.

Other provisioned rows stay pending when they are fixtures, archived or
unpublished products, unfinished templates, or lack a confirmed public launch.
Examples at that review included the Lango Learn course shell, the Hiring recruiter
workflow, and the AusTax frontend prototype. App provisioning and an HTTP 200
shell alone do not approve a public listing. The remaining classification is
tracked in platform issue #474.

Legacy owner taglines made from one repeated character fall back to the reviewed
description; they cannot replace product copy in the catalogue or shared SEO feed.

`sitemap-index.xml` includes the existing storefront sitemap plus each reconciled
app's `/sitemap.xml`. An app that declares a different primary canonical keeps its
store listing but its secondary-host sitemap is omitted. Private, unavailable and
noindex workspaces never contribute an app sitemap. Submit the index through the verified
`proappstore.online` Domain property: Google cross-site submission requires ownership
of every included host. The generated index accepts only the approved PAS launch
host's sitemap, never an arbitrary custom domain. Existing child submissions can
remain in Search Console.

Chess Clubs keeps its PAS launch listing, while its public front door is
`https://chessclubs.online/` (as documented in the app README). Its PAS sitemap
child is explicitly held with `sitemapUrl: null`; submit the custom-domain map
under its own verified property. Club workspace/member routes are not included.

## Owner-approved workspace listings

On 18 November 2026 the owner requested fixing publication and publishing Hiring.
Its approved catalogue description advertises the early recruiter workspace and
states that public candidate intake is closed. The signed-in app shell retains
its intentional `noindex` restriction; the marketing/legal draft and intake gates
are not changed by listing the product.

The curated entry sets `allowNoindexListing: true` to approve this separate public
listing. Only a literal `true` in the reviewed registry opts in; app/API metadata
cannot grant it. Public-inventory membership and a healthy HTML launch page remain
required. A noindex workspace never contributes its app sitemap, even with this
approval. Unapproved noindex apps remain excluded.
