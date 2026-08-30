# Legacy migration contract

The compatibility feed exposes aliases only. A client that resolves one must
apply this contract atomically and idempotently:

1. Read the installed legacy id and resolve exactly one `replacementId`.
2. Migrate persisted records by changing the owner/package id while retaining
   record ids, payloads, timestamps, and user data. Never create a second
   active copy.
3. Copy settings from the legacy namespace to the replacement namespace,
   preserving unknown keys and values. Mark the source namespace migrated only
   after the destination is durable; retrying must not duplicate or overwrite
   newer destination values.
4. Revalidate each persisted grant against the replacement manifest. Preserve
   only scopes that are explicitly allowed by that manifest, deny unknown
   scopes, and never widen a grant as a side effect of renaming.
5. Record the migration result and replacement id, then make the legacy entry
   read-only. On failure, keep the legacy data intact and retry safely.

The canonical mappings are Arrancador → `com.kosmos.arcadia`, Eden →
`com.kosmos.memoria`, and Delphi → `com.kosmos.agenda` (plus the retained
Arcadia alias → `com.kosmos.arcadia`).

The minimum supported client must test this contract with persisted ids,
unknown settings, grants containing unsupported scopes, restart, retry, and
rollback. Passing this repository's checks is not evidence that a consumer has
passed those gates.
