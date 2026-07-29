# School Verification Evidence Validator

This authenticated Supabase Edge Function validates the structure of private
student-verification evidence before a review request can use it.

It:

- accepts only `POST` JSON containing one `evidence_id`;
- asks the user-scoped
  `get_my_school_verification_evidence_validation_target` RPC for the exact
  private Storage path, declared MIME type, and declared byte size;
- downloads only that object from the private
  `school-verification-evidence` bucket with a service-role client;
- enforces the 8 MiB limit and exact declared size;
- checks JPEG, PNG, WebP, or PDF structure against the declared type;
- rejects PDFs containing active or hidden features such as JavaScript,
  launch actions, embedded files, open actions, rich media, XFA/forms,
  encryption, or object streams;
- records a SHA-256 digest through the service-only
  `complete_school_verification_evidence_validation` RPC; and
- records rejection and deletes rejected objects through the Storage API.

This is **structural and active-content validation, not antivirus or malware
scanning**. It reduces common file-confusion and active-PDF risks, but it does
not execute a malware engine or prove that a file is harmless. A production
verification program should add a dedicated malware-scanning service before
staff open user documents.

## Prerequisites

Deploy the SQL migration that defines both validation RPCs and the private
evidence state before deploying this function. The user-facing target RPC must
return one row or object with:

- `storage_path`
- `mime_type`
- `declared_size_bytes`

The completion RPC must be executable only by `service_role`.

Configure every production and preview origin explicitly. Only exact origins
from `VERIFICATION_ALLOWED_ORIGINS` or `SITE_URL` are accepted; local
development on `localhost`, `127.0.0.1`, or `::1` is the only automatic
exception. An unrelated `pages.dev` or `github.io` site is not trusted.

```sh
supabase secrets set VERIFICATION_ALLOWED_ORIGINS="https://your-domain.example,https://www.your-domain.example"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to hosted Supabase
Edge Functions. Never expose the service-role key to the browser.

Deploy with JWT verification **on** (the default):

```sh
supabase functions deploy validate-school-verification-evidence
```

Do not use `--no-verify-jwt`. The function also authenticates the user in code,
but platform JWT verification is an intentional first security boundary.
