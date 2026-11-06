# Synthetic Storefront candidate for platform#555

This handoff contains recruitment, app detail referral propagation, and the unchanged
#14 contributors browser consumer. It does not assert joint platform acceptance.
Candidate activation is independent of the production flag: ready and unavailable fixtures exercise both states. Production discovery uses the referral-readiness catalogue.

## Reproduce on Node 22 / POSIX

Check out the exact commit containing this document, then run (no npm install or
network access is needed for this build):

```sh
node scripts/build-candidate.cjs /tmp/storefront-candidate
node /tmp/storefront-candidate/serve.cjs 4174
```

The output directory must be empty and outside the checkout. Inputs are exactly
`test/fixtures/browser-registry.json` and
`test/fixtures/promoter-destination-ready.json`; inherited inventory and destination
settings cannot select live data. No API responses or contributor roster are built in.
The standalone server needs only the output directory and Node, serves clean URLs,
and has no source-tree fallback. Open `/promoters?app=synthetic-one` and
`/apps/synthetic-one/?ref=synthetic-ref`.

`candidate-manifest.json` identifies the Git revision, SHA-256 of every tracked
source input, aggregate source digest, every output digest and aggregate build
digest, plus SHA-256 asset identities. The manifest itself is excluded from output
digests. Use a clean checkout of the pinned revision for reproducibility; source
hashes also expose local edits. HTML retains its original script SRI values.
CI publishes `storefront-candidate-<full commit SHA>` using immutable v4 artifacts;
retrieve from the successful Test run for that exact SHA. The artifact includes
this transport contract and its standalone server.

## Local platform transport contract

Keep the browser's production-shaped HTTPS origins. In the isolated harness,
resolve/proxy `proappstore.online` to this static server,
`console.proappstore.online` to the candidate Console, and
`api.proappstore.online` to the real local platform backend. Use trusted local TLS
and preserve Host, Origin, cookies and normal API CORS/auth behavior. Resolve the
synthetic app hosts to the local app candidate when testing launch/referral flow.
These mappings must terminate locally with external egress blocked; do not proxy
unmapped requests to production. The server in this artifact is static only.

The ready handoff is `https://console.proappstore.online/#/promoter?app=synthetic-one`
(or synthetic-two); the candidate Console must preserve that hash-selected app
through its real local auth flow. No production signup change is included.
The real contributor request is anonymous GET
`https://api.proappstore.online/v1/storefront/apps/<app-id>/contributors`, with
credentials omitted and cache disabled. Team requests use the same API host.
Seed the real local backend with the two synthetic app IDs and exercise its real
opt-in and attribution data; this artifact supplies neither API mocks nor a roster.
Console authentication/providers are owned by the harness's local backend/host.
Google fonts and GitHub avatars may be blocked: local CSS/system fonts and text
remain usable. Other navigation links are not invitations to enable external egress.

Run normal unit/build/mobile/SRI/link/route checks separately. A successful artifact
build verifies packaging, not platform#555's real backend/browser evidence.
