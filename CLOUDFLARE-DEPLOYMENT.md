# ConCourse Cloudflare deployment

## Production

- URL: `https://concourse-95c.pages.dev`
- Cloudflare Pages project: `concourse`
- Production branch: `cloudflare-migration`
- Build command: `npm run build:pages`
- Published directory: `dist`

The Pages project uses Direct Upload because Cloudflare does not allow one
GitHub repository to use Pages Git integration across different Cloudflare
accounts. The old Pages project can therefore remain available during the
cutover.

## Automatic deployments

`.github/workflows/cloudflare-pages.yml` checks, builds, and deploys every push
to `cloudflare-migration`. The workflow publishes only the explicit allowlist
assembled by `scripts/build-pages.mjs`; repository SQL, tests, documentation,
patches, and Supabase source are not uploaded.

GitHub Actions stores these encrypted repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare account-owned token is named
`GitHub ConCourse Pages deployment` and has only Pages Write permission. Revoke
and replace that token if repository access changes or the credential may have
been exposed.

## Updating production

1. Make and test changes on `cloudflare-migration`.
2. Commit the intended files.
3. Push `cloudflare-migration` to GitHub.
4. Confirm the `Deploy ConCourse to Cloudflare Pages` workflow succeeds.
5. Smoke-test `https://concourse-95c.pages.dev`.

Cloudflare retains earlier immutable deployments for rollback.

## Supabase origin configuration

Supabase Auth uses `https://concourse-95c.pages.dev/` as its Site URL and an
allowed redirect URL. The citation and verification Edge Functions explicitly
allow the new Cloudflare origin. The legacy Cloudflare and GitHub Pages origins
remain allowed during the transition.

When a custom domain becomes the permanent public address, add its exact origin
to Supabase Auth and the Edge Function origin secrets before changing the
public build origin.
