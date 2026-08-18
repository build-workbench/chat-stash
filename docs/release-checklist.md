# ChatStash MVP release checklist

## Not yet a store release

Stages 7–12 are implemented with unit/contract tests. Tasks **7.5**, **8.4**,
**13.3**, **13.4**, and **13.7** still need live DeepSeek/ChatGPT smoke, user A/B
RLS in a browser, and a scenario-by-scenario spec walkthrough. Do not call the
MVP shipped until those pass.

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

Last automated run (2026-08-18, local): frozen install, format/lint/typecheck,
182 Vitest tests, `supabase test db` (90 pgTAP), `supabase db lint`, web production
build, extension production build, OpenSpec strict validation. `supabase db reset`
was not re-run in order to keep the local database; schema tests ran against the
already-migrated instance.

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
