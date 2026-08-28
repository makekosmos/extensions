# Kosmos Extensions

This repository is a frozen, compatibility-only catalog for legacy `.kext`
clients. It is not the source of truth for current product discovery or
installation.

Legacy entries in `catalog.json` carry an explicit `replacementId`:

- Arrancador and the legacy Arcadia entry migrate to `com.kosmos.arcadia`;
- Eden migrates to `com.kosmos.memoria`;
- Delphi migrates to `com.kosmos.agenda`.

New first-party discovery belongs in the signed Store catalog, and installation
authority belongs in the signed Package Index. Do not publish new first-party
artifacts here. The compatibility catalog is validated with:

```powershell
node scripts/validate-catalog.mjs
```
