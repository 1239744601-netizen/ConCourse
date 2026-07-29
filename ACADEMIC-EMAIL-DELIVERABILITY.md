# Academic Email Deliverability

Email delivery is shared work between ConCourse, its sending provider, and the
recipient university. Application code can make verification email safer and
clearer, but it cannot force a university gateway to accept a message or place
it in the inbox.

## What ConCourse Can Improve Now

- Send one short transactional message with a stable sender name, subject, and
  `From` address.
- Include both plain-text and minimal HTML versions. Keep the eight-digit code
  prominent; avoid attachments, remote images, emojis, marketing language, and
  unnecessary links.
- Disable click/open tracking. Supabase warns that link tracking can rewrite
  authentication links, and tracking domains can also reduce institutional
  trust.
- Keep the existing verification controls: codes expire after 10 minutes;
  resend is available after 60 seconds; limits are 3 sends per account per
  hour, 8 per account per day, and 5 per destination per day; each challenge
  permits at most 8 confirmation attempts.
- Show a masked destination, expiry, resend timer, and a clear message to check
  Junk, Quarantine, and the university email portal.
- Record provider message IDs and delivery outcomes without logging codes,
  provider credentials, full email bodies, or other secrets.

## Current Gmail SMTP Limitation

The Gmail SMTP account configured in **Supabase Auth → SMTP** is used for
Supabase Auth messages. Supabase does not expose those stored credentials as a
general email API for the separate academic-email Edge Function.

Sending as `concourse.support@gmail.com` also means Google, not ConCourse,
controls the `gmail.com` authentication and reputation. It cannot give
ConCourse an aligned branded sender such as `verification@notify.concourse…`,
and it cannot guarantee acceptance by a university gateway. Reusing the Gmail
app password in application code or an Edge Function would widen secret
exposure and is not recommended.

For testing, Gmail SMTP may deliver successfully. It is not the final
deliverability solution for academic verification.

## Production Sending Path

1. Own a domain that represents ConCourse.
2. Create a dedicated transactional subdomain, for example
   `notify.example.com`. Keep authentication mail separate from marketing mail.
3. Verify that subdomain with a transactional email provider supported by the
   academic-email Edge Function.
4. Publish the provider's SPF and DKIM DNS records.
5. Publish DMARC for the organizational domain. Begin with `p=none`, review
   reports and alignment, then move to `quarantine` or `reject` only when all
   legitimate senders pass.
6. Use an aligned address such as `verification@notify.example.com` in the
   visible `From` header. Use a monitored support address for `Reply-To`.
7. Require TLS, valid forward/reverse DNS at the provider, RFC-compliant
   headers, and stable sending infrastructure.
8. Keep link and open tracking disabled for verification mail.
9. Monitor delivery, bounce, complaint, and suppression events. Remove invalid
   destinations from future sends.
10. For a university-specific block, provide its mail administrator with the
    aligned sending domain, provider message ID, UTC timestamp, recipient, and
    SMTP rejection code, and request an allow-list review.

SPF, DKIM, DMARC alignment, TLS, low complaint rates, and clean bounce handling
substantially improve credibility. None guarantees inbox placement.

## Activation Checklist

Complete these steps in order:

- [ ] Keep the academic-email Edge Function JWT verification **on**.
- [ ] Run the academic-email database migration in the intended Supabase
      project before deploying the function.
- [ ] Verify the dedicated sending subdomain with the chosen provider.
- [ ] Publish exactly one SPF record for the sending domain and merge any
      existing authorized senders into it.
- [ ] Publish every DKIM selector supplied by the provider and confirm DKIM
      passes.
- [ ] Publish DMARC with aggregate reports enabled; confirm the visible
      `From` domain aligns with SPF or DKIM.
- [ ] Set the provider API key, OTP pepper, allowed origins, `From` name,
      `From` address, and `Reply-To` only in Supabase Edge Function secrets.
- [ ] Do not put provider keys, SMTP passwords, the OTP pepper, or the service
      role key in Git, browser JavaScript, SQL output, screenshots, or logs.
- [ ] Disable provider click tracking and open tracking for this message.
- [ ] Send test codes to Gmail, Outlook, and at least one real university
      mailbox. Check Inbox, Junk, Quarantine, and the school webmail portal.
- [ ] Confirm the received headers show `SPF=pass`, `DKIM=pass`, and
      `DMARC=pass`, with TLS used in transit.
- [ ] Confirm repeated sends and guesses are throttled at the limits above.
- [ ] Confirm only the newest code works and no code is stored or logged in
      plaintext.
- [ ] Check Supabase Function logs first, then provider delivery/suppression
      logs. After provider handoff, investigate the recipient gateway or ask
      its administrator to trace the message.
- [ ] Record a rollback contact and a backup transactional provider before a
      large launch.

## Missing-Email Triage

1. Confirm the masked destination shown by ConCourse is correct.
2. Check Supabase Edge Function logs for an authenticated request and successful
   provider response.
3. Search the provider by message ID for delivered, deferred, bounced,
   suppressed, or rejected status.
4. If accepted by the provider, check the university mailbox's Junk and
   Quarantine folders.
5. Ask the university administrator to trace the message and provide any SMTP
   rejection or quarantine reason. Supabase cannot control delivery after the
   message is handed to the provider.
6. Do not repeatedly resend during an active delay; wait for the 60-second
   timer and remain within the hourly and daily limits.

## Official Guidance

- [Supabase: Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: Sending emails from Edge Functions](https://supabase.com/docs/guides/functions/examples/send-emails)
- [Supabase: Not receiving Auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw)
- [Supabase: Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Google: Email sender guidelines](https://support.google.com/mail/answer/81126?hl=en)
- [Google: Email sender guidelines FAQ](https://support.google.com/mail/answer/14229414?rd=1)
- [Google Workspace: Troubleshoot delivery with Email Log Search](https://support.google.com/a/answer/7513679)
