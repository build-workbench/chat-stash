# ChatStash MVP release checklist

## Not yet a store release

Stages 7–12 are implemented with unit/contract tests. Tasks **7.5**, **8.4**,
**13.3**, and **13.4** still need live DeepSeek/ChatGPT smoke and user A/B
RLS in a browser. Do not call the MVP shipped until those pass.

Search EXPLAIN for task 11.5 is in `docs/search-explain.md`.

## Environment

- [ ] `supabase start` then `supabase db reset`
- [ ] Copy `apps/web/.env.example` and `apps/extension/.env.example` with the local
      Supabase URL and publishable key only. Leave `PLASMO_PUBLIC_ENABLE_SYNTHETIC`
      empty for a production-shaped extension build.
- [ ] Confirm Auth redirect URLs include `/auth/callback` and `/reset-password`
- [ ] Web: `corepack pnpm --filter @chatstash/web dev`
- [ ] Extension: `corepack pnpm --filter @chatstash/extension build` and load
      `apps/extension/build/chrome-mv3-prod` unpacked

> **Environment note (2026-08-21):** Docker 29.7.2 on this machine no longer
> honors bare `-e VAR` container env entries, which breaks `supabase start`
> (the CLI passes `POSTGRES_PASSWORD`/`JWT_SECRET` as bare names; the Postgres
> entrypoint then sees an empty password). The automated gates below were run
> against a standalone `public.ecr.aws/supabase/postgres:17.6.1.158` container
> started manually with explicit env (`POSTGRES_PASSWORD`, `JWT_SECRET`,
> `JWT_EXP`), migrated via `supabase db reset --db-url …?sslmode=disable`,
> linted via `supabase db lint --db-url …`, tested with a `supabase/pg_prove:3.36`
> runner container (`docker cp` for test files + `PGHOST/PGPORT/…` env), and
> typed via `supabase gen types typescript --db-url … --schema public --schema graphql_public`.
> Two one-time setup steps were needed on that standalone DB to emulate the
> CLI-managed stack: `CREATE EXTENSION pgtap` (dropped again before typegen)
> and an `auth.uid()` override that also reads `request.jwt.claims` JSON
> (matching the stack's function; the raw image only reads `request.jwt.claim.sub`).
> If Docker is downgraded or the CLI fixes bare-env handling, prefer plain
> `supabase start` / `db reset` / `test db`.

## Automated gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
supabase db reset
supabase db lint --level warning
supabase test db
corepack pnpm --filter @chatstash/web build
corepack pnpm --filter @chatstash/extension build
npx @fission-ai/openspec validate establish-chatstash-mvp --strict
```

Last automated run (2026-08-21, local): frozen install, format/lint/typecheck,
185 Vitest tests (10 shared + 55 adapters + 54 web + 66 extension), database
reset against a fresh standalone Postgres 17.6 instance, `db lint` clean,
90 pgTAP tests passing, generated-types diff **exact match**, web production
build, extension production build, OpenSpec strict validation. See the
environment note above for how the database gates were executed without
`supabase start`.

## Permission / secret audit (task 13.1)

Production-shaped `chrome-mv3-prod` manifest:

- `permissions`: `storage` only
- `host_permissions`: local Supabase `http://127.0.0.1:54321/*` (replace with the
  project HTTPS origin for a hosted build)
- content script `matches`: `https://chat.deepseek.com/*`, `https://chatgpt.com/*`,
  and `*://synthetic.chatstash.test/*`
- no `<all_urls>`, `tabs`, `cookies`, `webRequest`, or `scripting`

Plasmo requires a static `matches` literal, so the non-routable synthetic test
host stays in the manifest. Production builds still omit the synthetic adapter
unless `PLASMO_PUBLIC_ENABLE_SYNTHETIC=true`, and the background sender rejects
that host when the flag is off.

Bundle contains the **publishable** key only (`sb_publishable_…`). No
`service_role` / `sb_secret_` credential. `apps/` has no `console.log` of capture
bodies. Markdown rendering uses `react-markdown` + `remark-gfm` +
`rehype-highlight` without `rehype-raw`. Fixture `samples.log` uses conversation
placeholders, not live IDs.

`pnpm audit --prod` reports Plasmo-transitive Svelte/tsup advisories in unused
parcel transformers. They are not in the ChatStash React runtime. Do not bump
Plasmo only to chase those until a Plasmo release absorbs the patches.

## Manual smoke (do not log conversation bodies)

1. Create and confirm user A on Web; sign in the Extension independently.
2. On `https://chat.deepseek.com/`, save a plain, code, and table reply. Streaming
   replies must stay unsavable until generation finishes. Saving twice is duplicate.
3. On `https://chatgpt.com/`, repeat. Regenerated/branch visible pair only.
4. Dashboard: list, detail, GFM render, delete, folders, tags, Chinese/English search,
   single Markdown export.
5. User B cannot read or infer user A's records.
6. Manifest page matches are only ChatGPT, DeepSeek, and the synthetic test host.
   Privileged keys are absent from the browser bundle.

### Adapter smoke record template (tasks 7.5 / 8.4 / 13.4)

Copy this table once per platform per session; fill every cell, never paste
conversation bodies:

```text
Platform: deepseek | chatgpt
Date / time:
Browser + version:
Extension build (unpacked chrome-mv3-prod?):
Supabase target (local 127.0.0.1:54321 | hosted origin):

| Check                          | Result (pass/fail) | Selector tier used (primary/fallback) | Notes |
|--------------------------------|--------------------|---------------------------------------|-------|
| Save button appears on replies |                    |                                       |       |
| Plain reply saved              |                    |                                       |       |
| Code-block reply saved         |                    |                                       |       |
| Table reply saved              |                    |                                       |       |
| Streaming reply not saveable   |                    | n/a                                   |       |
| Completes to saveable          |                    | n/a                                   |       |
| Second save shows duplicate    |                    | n/a                                   |       |
| Earlier turn pairs correctly   |                    |                                       |       |
| SPA new-chat switch clean      |                    | n/a                                   |       |
| History navigation clean       |                    | n/a                                   |       |
| healthCheck diagnostics sane   |                    |                                       |       |

Failures: file an adapter fix against its fixture set; do not loosen validation.
```

### User A/B security regression template (task 13.3)

Run in a private window with two confirmed accounts; record pass/fail only:

```text
Date / builds:
Web host: Extension build:

| Check                                                              | Expected                       | Result |
|--------------------------------------------------------------------|--------------------------------|--------|
| B opens A's conversation URL from Extension save                    | opaque not-found               |        |
| B guesses a conversation UUID in Dashboard URL                      | same not-found as missing      |        |
| B lists conversations                                               | never contains A rows          |        |
| B searches A's known title/content                                  | zero hits                      |        |
| B attempts move/delete/tag of A's conversation via API              | rejected (RLS), no data change |        |
| Data API grants snapshot (conversations/messages INSERT for auth.)  | absent                         |        |
| RLS enabled on all six tables                                       | yes                            |        |
| RPC EXECUTE revoked from anon                                       | yes                            |        |
| Extension content context cannot read session token                 | yes                            |        |
```

Snapshot commands for the grant checks live in `supabase/tests/database/020_rls_isolation.test.sql`
(the pgTAP suite already proves them; this browser pass re-verifies end to end).

## Known limits

- ChatGPT fixtures use the public `data-message-author-role` contract. Re-sample live
  sanitized DOM before store submission if ChatGPT has shipped a layout change.
- DeepSeek streaming fixture is synthesized from 2026-08-14 completed DOM plus the
  capture script's stop/cursor markers. Confirm `停止生成` still exists on live pages.
- Virtualized DeepSeek threads only expose visible turns; earlier turns fail closed.
- Web and Extension sessions are independent.
- No Chrome Web Store listing, billing, sharing, or extra AI sites in this MVP.
- `openspec/config.yaml` still mentions Tailwind/shadcn; the implemented dashboard
  uses semantic CSS only.

## Rollback

- Web: redeploy the previous Vercel/hosting deployment.
- Database: do not rewrite history; add a forward migration if a hotfix is required.
- Extension: unload the unpacked build; users on an older packed build are unaffected
  until a store publish exists.
