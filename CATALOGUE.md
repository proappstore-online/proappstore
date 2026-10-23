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
