# ConCourse Cloudflare deployment

## Production

- Public URL: `https://concoursehk.com`
- Cloudflare Pages project: `concourse`
- GitHub source branch: `main`
- Cloudflare production branch label: `cloudflare-migration`
- Build command: `npm run build:pages`
- Published directory: `dist`

## Beta

- Review URL: `https://beta.concoursehk.com`
- GitHub source branch: `beta`
- Cloudflare preview branch label: `beta`
- Build command: `npm run build:pages`
- Published directory: `dist`

The Pages project uses Direct Upload because Cloudflare does not allow one
GitHub repository to use Pages Git integration across different Cloudflare
accounts. The application is served only from the production and beta hostnames.
Provider-generated `pages.dev` hostnames are retired and cannot serve the
application. The beta response is uncacheable and carries a search-engine
`noindex` policy. Its canonical and social metadata intentionally point to the
production origin so search engines and shared previews never treat beta as a
second official site.

## Automatic deployments

`.github/workflows/cloudflare-pages.yml` checks, builds, and deploys every push
to `main`. Wrangler publishes that commit to the existing Cloudflare production
branch label, `cloudflare-migration`, so the custom domain receives the same
release without moving the domain or recreating the Pages project. The workflow
publishes only the explicit allowlist assembled by `scripts/build-pages.mjs`;
repository SQL, tests, documentation, patches, and Supabase source are not
uploaded.

`.github/workflows/cloudflare-pages-beta.yml` applies the same checks to every
push to `beta`, builds an artifact bound only to `beta.concoursehk.com`, and
publishes it to the Pages `beta` preview branch. The custom beta hostname is a
proxied CNAME to `beta.concourse-95c.pages.dev`, as required for a Pages custom
branch alias. Provider-generated branch and hash URLs are covered by the
account redirect; the origin-bound Worker also returns `410 Gone` if one
reaches it directly.

The beta hostname is intentionally public so design revisions can be reviewed
without a separate access prompt. Beta responses remain `noindex`, `noarchive`,
and `no-store`; provider preview URLs stay retired and the Worker remains bound
to the approved beta origin. Beta currently uses the production Supabase
configuration, so it must preserve the same authorization boundaries as the
production application. Use a separate staging Supabase project before adding
test-only privileged data or widening backend capabilities.

GitHub Actions stores these encrypted repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare account-owned token is named
`GitHub ConCourse Pages deployment` and has only Pages Write permission. Revoke
and replace that token if repository access changes or the credential may have
been exposed.

## Updating beta and production

1. Merge reviewed feature work into `beta`.
2. Confirm the beta workflow succeeds.
3. Test the release at `https://beta.concoursehk.com`.
4. Open and merge a `beta` to `main` pull request.
5. Confirm the production workflow succeeds.
6. Smoke-test `https://concoursehk.com`.

Cloudflare retains earlier immutable deployments for rollback. On the current
Pages project, the account redirect prevents those generated hostnames from
serving a second public copy.

Pages Runtime must use **Fail closed**. The domain allowlist is enforced by the
Pages Function, so static assets must not be served if the Function allowance
is exhausted.

The `concoursehk.com` zone must keep Browser Cache TTL set to
**Respect Existing Headers**. Mutable HTML, JavaScript, module, and stylesheet
responses then follow the revalidation policy in `_headers` instead of being
held in visitors' browsers for Cloudflare's four-hour default.

## Supabase origin configuration

Supabase Auth must use `https://concoursehk.com/` as its Site URL and sole
hosted redirect origin. Citation and verification Edge Functions must set their
allowed-origin secrets to the exact `https://concoursehk.com` origin. Do not
allow Cloudflare Pages previews or GitHub Pages.
