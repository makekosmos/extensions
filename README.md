# Kosmos Extensions

This repository is a frozen, compatibility-only catalog for legacy `.kext`
clients. It is not the source of truth for current product discovery or
installation.

Legacy entries in `catalog.json` carry explicit deprecation and
`replacementId` metadata. The exact migration contract is versioned in
`catalog.json` and explained in [docs/migration-contract.md](docs/migration-contract.md):

- Arrancador and the legacy Arcadia entry migrate to `com.kosmos.arcadia`;
- Eden migrates to `com.kosmos.memoria`;
- Delphi migrates to `com.kosmos.agenda`.

A compatibility client may resolve these aliases for upgrade, but no entry in
this feed is an active current product. New first-party discovery belongs in
the signed Store catalog, and installation authority belongs in the signed
Package Index. Do not publish new first-party artifacts here.

## Validation

The local catalog gate rejects duplicate identities, malformed metadata, non-HTTPS or
invalid artifact integrity values, missing deprecation reasons/replacements, and
replacement cycles:

```powershell
node scripts/validate-catalog.mjs
node --test scripts/validate-catalog.test.mjs
```

The frozen client window, cutover checklist, and archive policy are in
[docs/compatibility-cutover.md](docs/compatibility-cutover.md). The final
migration of existing `.kext` data, settings, and grants remains a
consumer/client release gate; this repository cannot prove that external
upgrade path by itself.

The GitHub workflow is manual-only to avoid spending Actions quota on this
compatibility-only repository; it replays the same local commands on demand.

## Local hooks

Install Lefthook for automatic pre-commit and pre-push checks, or run the two
Node commands above directly. The checked-in `lefthook.yml` contains no
secrets and only validates this compatibility feed.
