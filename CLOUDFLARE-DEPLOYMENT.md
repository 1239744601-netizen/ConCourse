# ConCourse Cloudflare deployment

## Production

- Public URL: `https://concoursehk.com`
- Cloudflare Pages project: `concourse`
- GitHub source branch: `main`
- Cloudflare production branch label: `cloudflare-migration`
- Build command: `npm run build:pages`
- Published directory: `dist`

The Pages project uses Direct Upload because Cloudflare does not allow one
GitHub repository to use Pages Git integration across different Cloudflare
accounts. `concoursehk.com` is the only public application origin. Cloudflare
redirects the project's `pages.dev` hostname and deployment previews to the
canonical domain.

## Automatic deployments

`.github/workflows/cloudflare-pages.yml` checks, builds, and deploys every push
to `main`. Wrangler publishes that commit to the existing Cloudflare production
branch label, `cloudflare-migration`, so the custom domain receives the same
release without moving the domain or recreating the Pages project. The workflow
publishes only the explicit allowlist assembled by `scripts/build-pages.mjs`;
repository SQL, tests, documentation, patches, and Supabase source are not
uploaded.

GitHub Actions stores these encrypted repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare account-owned token is named
`GitHub ConCourse Pages deployment` and has only Pages Write permission. Revoke
and replace that token if repository access changes or the credential may have
been exposed.

## Updating production

1. Make and test changes on `main`.
2. Commit the intended files.
3. Push `main` to GitHub.
4. Confirm the `Deploy ConCourse to Cloudflare Pages` workflow succeeds.
5. Smoke-test `https://concoursehk.com`.

Cloudflare retains earlier immutable deployments for rollback.

The `concoursehk.com` zone must keep Browser Cache TTL set to
**Respect Existing Headers**. Mutable HTML, JavaScript, module, and stylesheet
responses then follow the revalidation policy in `_headers` instead of being
held in visitors' browsers for Cloudflare's four-hour default.

## Supabase origin configuration

Supabase Auth must use `https://concoursehk.com/` as its Site URL and sole
hosted redirect origin. Citation and verification Edge Functions must set their
allowed-origin secrets to the exact `https://concoursehk.com` origin. Do not
allow Cloudflare Pages previews or GitHub Pages.
