# CourseKeys Cloudflare Boundary

The integrated `/coursekeys` page is intentionally a read-only course-workspace
preview. It retains the approved prototype's storage architecture:

- `DB`: Cloudflare D1 metadata.
- `COURSE_MATERIALS`: a private R2 quarantine bucket.

No live resource identifiers or credentials belong in this repository. Configure
both bindings in the Cloudflare Pages project dashboard. Keep the R2 `r2.dev`
domain disabled, attach no public custom domain, and never expose object keys or
signed URLs to the browser.

`migrations/0001_coursekeys_metadata.sql` is the retained prototype foundation,
not a production-ready migration and not Supabase SQL. Do not apply it until the
missing controls named in its header have been implemented and reviewed.

## Current fail-closed behavior

`/api/coursekeys/resources` reports integration readiness on `GET` and rejects
every mutation. It never queries D1, reads R2 bytes, writes an object, returns a
storage key, creates a download URL, or mutates a CourseKeys balance.

The following Pages environment variables document the required server-side
gates. Their only accepted enabled value is the exact string `true`; however,
the integration lock still keeps all capabilities disabled:

- `COURSEKEYS_SECURE_AUTH_READY`
- `COURSEKEYS_VERIFICATION_READY`
- `COURSEKEYS_SCANNING_READY`
- `COURSEKEYS_MODERATION_READY`
- `COURSEKEYS_QUOTAS_READY`
- `COURSEKEYS_DELETION_READY`
- `COURSEKEYS_LEDGER_READY`

Do not add upload or delivery logic until all relevant gates are backed by
server-side enforcement and regression tests. In particular:

1. Verify the Supabase access token server-side and use the immutable user UUID.
2. Recheck a current, unrevoked institution verification for each protected
   operation.
3. Reserve per-user, per-day, and total storage quotas atomically before an R2
   write and release reservations after failures.
4. Verify file signatures, compute immutable checksums, scan object versions,
   and retain moderator identity and decision history.
5. Implement idempotent deletion, retention, legal-hold, retry, and orphan
   reconciliation workflows.
6. Enforce balanced, atomic, idempotent ledger posting, reversals, and
   concurrent spend protection.

Public downloads and CourseKeys transactions must remain absent until every
listed control is complete.
