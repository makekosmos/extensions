# Legacy extensions compatibility cutover

This repository is a frozen compatibility feed for clients that still know
the `.kext` catalog format. It is not an application marketplace and is not a
source of truth for current products.

## Frozen client window

The supported window is the final legacy client line (`supportedClientMax:
legacy`). During that window a client may read this feed to resolve an
existing installation and perform a one-time migration. It must not use the
feed for new discovery, install, update, or release publication.

The feed was frozen on 2026-08-30. No new first-party artifacts may be added.
The feed can be retired after the consumer gates below are green for the
minimum supported client release. Until then, leave the catalog available and
immutable so rollback and repair of old installs remain possible.

## Unambiguous replacements

| Legacy id | Replacement package id |
| --- | --- |
| `arrancador` | `com.kosmos.arcadia` |
| `eden` | `com.kosmos.memoria` |
| `delphi` | `com.kosmos.agenda` |

The retained `arcadia` legacy alias also resolves to
`com.kosmos.arcadia`. These are upgrade aliases, not additional active apps;
every catalog entry is `legacy` or `deprecated`.

## Consumer cutover gates

Before deleting an old install or retiring this feed, the Manager/Host
consumer must provide evidence for all of the following:

1. Store is used for discovery and signed Package Index is used for install
   and update authority.
2. A persisted legacy id is mapped before reads and writes, including a
   restart/rollback test.
3. Settings are copied into the replacement namespace without losing unknown
   keys or corrupting values; the copy is durable before the old namespace is
   made read-only.
4. Grants are revalidated against the replacement manifest, unknown scopes are
   denied, and no grant is broadened during migration.
5. A legacy `.kext` upgrade succeeds with an offline/failed-network path and
   leaves the user with exactly one enabled current package.

This repository validates the contract and catalog shape only. It cannot claim
these external consumer gates are complete.

## Source of truth and archive policy

Current product metadata and artifacts belong to the signed Store and Package
Index. Do not publish releases or production secrets here. Changes to this
feed are limited to compatibility fixes and documentation; CI and local hooks
must pass the catalog validator and tests for every change.
