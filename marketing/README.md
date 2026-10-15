# App marketing site builder

`npm run build:marketing -- --snapshot <approved-snapshot.json> --assets-dir <approved-image-directory> --out <output-directory>` builds one Astro static site for one app revision. Add `--preview` for noindex output. The source snapshot is never copied to the output; only images named in the validated snapshot are copied. The output includes an `artifact-manifest.json` with the app ID, revision, paths, content types and SHA-256 hashes. The host/deployment work in platform#399 will verify this manifest before activation.

`fixtures/sample.json` is test content only. It is not an approved app listing or a site to publish. The platform content contract in platform#398 must produce immutable, owner-approved snapshots with the same schema before production publishing is enabled.

`npm run build:previews` builds the sample plus the Kanban Pro and Micro concept pages at `/preview/<app-id>/` for the storefront deploy. These are noindex drafts with disabled app links, based on the public registry. Stock photographs are labeled as editorial imagery and credited in each snapshot; they are not product screenshots. The real `about-<app-id>` websites still require owner approval and the activation pipeline in platform#399.
