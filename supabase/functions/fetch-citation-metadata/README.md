# Citation Metadata Function

This function supports two free lookup modes:

- Exact public URL lookup reads page metadata directly.
- Keyword lookup searches Crossref’s public scholarly metadata. It is not a
  general web search, so ordinary commercial webpages may not appear.

Deploy the SQL files before the function:

1. `supabase-citation-metadata-setup.sql`
2. `supabase-citation-search-quota.sql`

Configure the exact production site origin as a secret. No hosted preview
domain is accepted automatically.

```sh
supabase secrets set CITATION_ALLOWED_ORIGINS="https://concoursehk.com"
supabase secrets set CITATION_CONTACT_URL="https://concoursehk.com"
supabase functions deploy fetch-citation-metadata
```

Keep Supabase JWT verification enabled. The function also validates the signed-in
user before performing a lookup. Do not add a paid search key: keyword results
use Crossref.
