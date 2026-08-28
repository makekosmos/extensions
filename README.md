# Kosmos Extensions

This repository is a frozen, compatibility-only catalog for legacy `.kext`
clients. It is not the source of truth for current product discovery or
installation.

Legacy entries in `catalog.json` carry explicit deprecation and
`replacementId` metadata:

- Arrancador and the legacy Arcadia entry migrate to `com.kosmos.arcadia`;
- Eden migrates to `com.kosmos.memoria`;
- Delphi migrates to `com.kosmos.agenda`.

A compatibility client may resolve these aliases for upgrade, but no entry in
this feed is an active current product. New first-party discovery belongs in
the signed Store catalog, and installation authority belongs in the signed
Package Index. Do not publish new first-party artifacts here.

## Validation

Catalog CI rejects duplicate identities, malformed metadata, non-HTTPS or
invalid artifact integrity values, missing deprecation reasons/replacements, and
replacement cycles:

```powershell
node scripts/validate-catalog.mjs
node --test scripts/validate-catalog.test.mjs
```

The final migration of existing `.kext` data, settings, and grants remains a
consumer/client release gate; this repository cannot prove that external
upgrade path by itself.
