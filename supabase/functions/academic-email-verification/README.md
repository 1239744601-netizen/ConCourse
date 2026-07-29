# Academic Email Verification

This authenticated Edge Function sends and confirms an eight-digit ownership
code for a student's institution email. A correct code submits an
`academic_email` evidence request to the existing human-review queue. It does
**not** set a membership to `verified`.

## Security boundary

- Supabase platform JWT verification stays enabled.
- The request must come from an exact allowed origin.
- Only administrator-maintained institution/domain pairs are accepted.
- A legacy account with no school-membership row may receive a new **pending**
  membership only when its academic domain resolves to one unique canonical
  institution in that administrator allow-list. This never verifies it.
- Codes expire after 10 minutes and are never stored in plaintext.
- The database stores only a peppered HMAC-SHA-256 digest.
- The pepper and service-role key exist only in Edge Function secrets.
- Resends are limited to one per minute, three per hour, eight per account per
  day, and five per destination per day.
- A challenge accepts at most eight confirmation attempts.
- A confirmed address creates a submitted review request. A reviewer must still
  approve it through the Verification Center.

Run `supabase-academic-email-verification.sql` before deploying this function.

## Secrets

Create a random pepper of at least 32 characters. Do not reuse a database,
Supabase JWT, SMTP, or provider secret.

```sh
supabase secrets set \
  ACADEMIC_EMAIL_OTP_PEPPER="GENERATE-A-LONG-RANDOM-SECRET" \
  VERIFICATION_ALLOWED_ORIGINS="https://concoursehk.pages.dev,https://1239744601-netizen.github.io" \
  ACADEMIC_EMAIL_PROVIDER="resend" \
  ACADEMIC_EMAIL_FROM_ADDRESS="verification@notify.your-domain.example" \
  ACADEMIC_EMAIL_FROM_NAME="ConCourse" \
  ACADEMIC_EMAIL_REPLY_TO="support@your-domain.example" \
  RESEND_API_KEY="YOUR-RESEND-API-KEY"
```

For Brevo, set `ACADEMIC_EMAIL_PROVIDER=brevo` and `BREVO_API_KEY` instead of
`RESEND_API_KEY`.

The Gmail SMTP credentials configured under **Supabase Auth → SMTP** cannot be
reused directly by an Edge Function: Supabase does not expose those stored
credentials or a general-purpose Auth mail-sending API. They cover Supabase
Auth messages such as sign-up confirmation, not this separate academic-email
challenge. ConCourse therefore needs a transactional provider API configured
as Edge Function secrets. Re-entering the same Gmail app password in an Edge
Function would widen secret exposure and still would not provide aligned
SPF/DKIM/DMARC, so it is not recommended.

Deploy with JWT verification **on**:

```sh
supabase functions deploy academic-email-verification
```

Do not use `--no-verify-jwt`.

## Deliverability

Application code cannot force a university mail gateway to accept a message.
For credible production delivery, send from a domain ConCourse controls:

1. use a dedicated transactional subdomain such as `notify.example.com`;
2. verify that domain with the selected email provider;
3. publish the provider's SPF and DKIM records;
4. publish DMARC for the organisational domain, starting with monitoring
   (`p=none`) and moving to enforcement after reviewing reports;
5. keep the visible `From` domain aligned with DKIM/DMARC;
6. never send these codes from an unaligned personal Gmail address;
7. monitor provider bounces and university-specific blocks; and
8. ask a university mail administrator to allow-list the aligned sending domain
   when its institutional policy still rejects transactional mail.

SPF, DKIM, DMARC, a stable sender identity, low complaint rates, and clean
bounce handling substantially improve trust, but they cannot guarantee inbox placement.
Users should still be told to check Junk/Quarantine and request a
new code only after the resend timer ends.

## Browser contract

The signed-in Supabase client invokes the same function for both actions.

Request:

```js
const { data, error } = await supabase.functions.invoke(
  "academic-email-verification",
  {
    body: {
      action: "send",
      academic_email: "student@life.hkbu.edu.hk",
    },
  },
);
```

Success:

```json
{
  "status": "sent",
  "challenge_id": "00000000-0000-4000-8000-000000000000",
  "masked_email": "s•••••t@life.hkbu.edu.hk",
  "expires_in_seconds": 600,
  "resend_after_seconds": 60
}
```

Confirm:

```js
const { data, error } = await supabase.functions.invoke(
  "academic-email-verification",
  {
    body: {
      action: "confirm",
      challenge_id: challengeId,
      code: codeInput,
    },
  },
);
```

Success means the request is waiting for a reviewer:

```json
{
  "status": "submitted_for_review",
  "request_id": "00000000-0000-4000-8000-000000000000",
  "human_review_required": true
}
```

The UI may call `get_my_academic_email_verification_state()` to restore the
latest masked address, expiry, resend time, and remaining attempts after a page
refresh. It must not describe code confirmation as final student verification.
