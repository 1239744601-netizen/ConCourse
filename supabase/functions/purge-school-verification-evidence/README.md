# School Verification Evidence Retention Worker

This Supabase Edge Function permanently removes private school-verification
evidence after the retention date set by the database migration.

The worker is intentionally server-only. It:

1. calls `get_school_verification_evidence_cleanup_batch` with a batch limit of
   1–100;
2. validates every returned private path;
3. deletes exact paths from the private `school-verification-evidence` bucket
   through the Supabase Storage API in chunks of 20; and
4. passes only successfully deleted or already-absent evidence IDs to
   `finalize_school_verification_evidence_cleanup`.

The finalization RPC removes the corresponding private metadata. Storage
objects are never deleted directly with SQL. Responses contain counts only;
they never include private paths, file names, hashes, or evidence IDs.

## Security configuration

Generate a separate, random secret of at least 32 bytes. Do not reuse the
service-role key or a user JWT.

```sh
openssl rand -base64 48
supabase secrets set SCHOOL_VERIFICATION_CLEANUP_SECRET="paste-the-generated-value"
```

Hosted Edge Functions receive `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never be exposed in the
website or scheduled request body.

This endpoint uses its own constant-time secret check and must be callable
without a user JWT:

```sh
supabase functions deploy purge-school-verification-evidence --no-verify-jwt
```

No deployment was performed by Codex. Deploy only after reviewing the source
and running the matching SQL migration.

The request must be a server-to-server `POST`, must not contain an `Origin` or
`Cookie` header, and must contain:

```text
Content-Type: application/json
x-cleanup-secret: <SCHOOL_VERIFICATION_CLEANUP_SECRET>
```

with the exact body:

```json
{}
```

An `Authorization` or `apikey` header is optional. If supplied, it must exactly
match the service-role key; user and anonymous JWTs are rejected.

## Scheduling

Run the worker periodically (daily is sufficient for the default retention
window) using a trusted scheduler such as Supabase Cron/`pg_cron` plus
`pg_net`, GitHub Actions with an environment secret, or another server-side
scheduler. Store `SCHOOL_VERIFICATION_CLEANUP_SECRET` only in that scheduler's
encrypted secret store.

Example request shape:

```sh
curl --fail-with-body \
  --request POST \
  --header "Content-Type: application/json" \
  --header "x-cleanup-secret: ${SCHOOL_VERIFICATION_CLEANUP_SECRET}" \
  --data '{}' \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/purge-school-verification-evidence"
```

Optionally set `SCHOOL_VERIFICATION_CLEANUP_BATCH_LIMIT` to a number from
1–100. Invalid values use the default of 50.

Run the worker repeatedly until `scanned` is zero when clearing a backlog.
Failed Storage chunks remain eligible for a later run, and metadata is
finalized only after the Storage API reports deletion or absence.

The migration controls the retention period and which terminal request states
become eligible. Changing the schedule does not shorten that database-enforced
retention date.
