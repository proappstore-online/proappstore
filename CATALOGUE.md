# Public catalogue

`registry.json` contains approved listing copy, not the provisioning inventory.
Production builds reconcile it with the current public API inventory and live
launch pages. Only approved entries still public, returning HTML successfully,
and allowing indexing enter the homepage, detail pages, sitemap and
`catalogue.json`. A new API row alone never publishes an internal tool or fixture.

Four reviewed real apps now have catalogue copy: TradePort, Bookkeeper, QueueFlow
and Comps. Their descriptions come from their existing app documentation.
Carsads migrated away from its old PAS origin; Studio has no live PAS origin;
the old Codex smoke app is a test fixture. Those stale entries are no longer listed.

Deployment runs on source changes, manual dispatch and hourly. It removes obsolete
generated detail directories and publishes the reconciled public registry. A
404/410 or explicit noindex omits a listing; an API outage, timeout or temporary
launch error aborts deployment rather than silently removing healthy apps.
`catalogue-report.json` distinguishes excluded entries from API records awaiting
approved listing copy. Complete and review that copy before adding those entries
to the source catalogue. Visibility/unpublishing changes reconcile within an hour.

Local builds/tests remain deterministic. To build the current public inventory:

```
node scripts/reconcile-catalogue.cjs --out .catalogue-build.json
REGISTRY_PATH=.catalogue-build.json npm run build
```

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
Examples include the Lango Learn course shell, the private Hiring recruiter
workflow, and the AusTax frontend prototype. App provisioning and an HTTP 200
shell alone do not approve a public listing. The remaining classification is
tracked in platform issue #474.

Legacy owner taglines made from one repeated character fall back to the reviewed
description; they cannot replace product copy in the catalogue or shared SEO feed.

`sitemap-index.xml` includes the existing storefront sitemap plus each reconciled
app's `/sitemap.xml`. An app that declares a different primary canonical keeps its
store listing but its secondary-host sitemap is omitted. Private, unavailable and
noindex entries already fail reconciliation. Submit the index through the verified
`proappstore.online` Domain property: Google cross-site submission requires ownership
of every included host. The generated index accepts only the approved PAS launch
host's sitemap, never an arbitrary custom domain. Existing child submissions can
remain in Search Console.

Chess Clubs keeps its PAS launch listing, while its public front door is
`https://chessclubs.online/` (as documented in the app README). Its PAS sitemap
child is explicitly held with `sitemapUrl: null`; submit the custom-domain map
under its own verified property. Club workspace/member routes are not included.
