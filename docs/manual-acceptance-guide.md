# Manual acceptance guide (tasks 7.5, 8.4, 13.3, 13.4)

This guide walks through the four remaining MVP acceptance tasks. Everything
else in `establish-chatstash-mvp` is implemented and passing automated gates
(see `release-checklist.md`). These four tasks are browser-based manual checks
because they need a real logged-in ChatGPT/DeepSeek session and two real user
accounts. **Never paste conversation bodies into the records — pass/fail only.**

Order matters: run the environment setup once, then 7.5, then 8.4, then 13.3
and 13.4 (13.4's record is assembled from the 7.5/8.4 tables).

---

## 0. One-time environment setup

### 0.1 Backend

The local Supabase stack is required (Auth + Data API + Postgres), not just a
standalone Postgres: sign-up/sign-in from Web and Extension need GoTrue.

```bash
# Docker 29.7.2 bug (see release-checklist environment note): `supabase start`
# fails if bare `-e VAR` entries lose their values. Try plain `supabase start`
# first; if the Postgres container exits with an empty password error, use one
# of these escapes:
#   a) downgrade Docker, or
#   b) run the stack containers manually with explicit env, mirroring what the
#      release-checklist note documents for the DB gates, plus
#      gotrue/auth containers started with explicit POSTGRES_PASSWORD/JWT_SECRET.
supabase start
supabase db reset
```

Local endpoints after `supabase start`: Data API `http://127.0.0.1:54321`,
Studio `http://127.0.0.1:54323`, Inbucket (confirmation emails)
`http://127.0.0.1:54324`.

Note: `apps/extension/package.json` `host_permissions` is the static local
origin `http://127.0.0.1:54321/*`. If you switch to a hosted Supabase project
instead, change that entry to the hosted origin before building.

### 0.2 Web app

```bash
cp apps/web/.env.example apps/web/.env
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
# NEXT_PUBLIC_APP_URL=http://localhost:3000
corepack pnpm --filter @chatstash/web dev   # http://localhost:3000
```

### 0.3 Extension (production-shaped build)

`apps/extension/.env` already holds local values, but for the acceptance build
the synthetic flag must be empty:

```text
PLASMO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PLASMO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
PLASMO_PUBLIC_WEB_URL=http://localhost:3000
PLASMO_PUBLIC_ENABLE_SYNTHETIC=          # must be empty
```

```bash
corepack pnpm --filter @chatstash/extension build
```

Verify the build manifest before loading it
(`apps/extension/build/chrome-mv3-prod/manifest.json`):

- `permissions`: `["storage"]`
- `host_permissions`: `["http://127.0.0.1:54321/*"]`
- content script `matches`: only `chat.deepseek.com`, `chatgpt.com`,
  `synthetic.chatstash.test`

Load in Chrome: `chrome://extensions` → enable Developer mode → **Load
unpacked** → select `apps/extension/build/chrome-mv3-prod`. After every
rebuild, click the reload icon on that card.

### 0.4 Accounts

1. Web → `http://localhost:3000/sign-up` → create **user A** → confirm the
   email via the Inbucket link → sign in on Web.
2. Extension popup → sign in as user A (sessions are independent; signing in
   the Extension does not reuse the Web session).
3. In a private window, create and confirm **user B** (Web). B is used only in
   task 13.3.

---

## 1. Task 7.5 — DeepSeek live smoke

Preconditions: user A signed in via the Extension popup; production build
loaded; Web dev server running.

On `https://chat.deepseek.com/`:

1. Open a conversation with a completed plain-text reply → the ChatStash save
   control must render near the reply (`data-chatstash-control` present). Save →
   state becomes `saved`.
2. Find/generate a reply containing a fenced code block → save.
3. Find/generate a reply containing a table → save.
4. Start a new long streaming answer → the save control must stay
   unsavable while streaming; wait for completion → it becomes saveable.
5. Click save again on the step-1 conversation → state `duplicate` (verify no
   second row was created in Dashboard).
6. Open an earlier turn of the same multi-turn thread → save it → check in
   Dashboard that the stored prompt/response pair matches the visible pair.
7. Navigate SPA-style: new chat → history → another conversation. No save
   control residue, no unintended saves.
8. Sanity-check adapter diagnostics: the save control rendering with valid
   targets on every reply is the observable signal (see the `healthCheck` row
   in the smoke template).

Record results in the template in §4, then mark 7.5 `[x]` only if every row
passes.

## 2. Task 8.4 — ChatGPT live smoke

Repeat the full task-7.5 sequence on `https://chatgpt.com/`, plus:

- regenerate/branch: on a conversation where you regenerated a reply, save the
  currently visible pair only — the stored pair must match the visible branch;
  ambiguous cases must fail closed (no save), never guess.
- After both platforms pass, confirm the manifest still lists exactly the two
  AI hosts + Supabase origin and no `<all_urls>` (already true of the build;
  re-check after any rebuild).


## 3. Task 13.3 — User A/B end-to-end security regression

Private-window setup: user A signed in on Web + Extension; user B signed in on
Web in a separate private window. Run the template from
`release-checklist.md` §"User A/B security regression template" and fill every
row. Procedure highlights:

1. From an Extension save by A, copy the conversation URL and open it as B →
   must be an opaque not-found (identical to a missing UUID).
2. B guesses conversation UUIDs directly in `/conversations/[id]` → same
   not-found; B's list and search never surface A's rows.
3. B attempts writes against A's row (move to folder, tag, delete) → all
   rejected by RLS, no data change.
4. Snapshot checks (the pgTAP suite in
   `supabase/tests/database/020_rls_isolation.test.sql` already proves these;
   re-verify live):
   - Data API grants: `conversations`/`messages` have no direct INSERT grant
     for `authenticated` (writes go through `save_capture_v1`).
   - RLS enabled on all six tables.
   - RPC EXECUTE revoked from `anon`.
5. The Extension content-script context must not be able to read the session
   token.

## 4. Task 13.4 — Smoke record

For each platform record: date/time, browser + version, extension build
(unpacked `chrome-mv3-prod`), Supabase target, and the per-platform table
filled in tasks 7.5/8.4. That assembled record **is** the 13.4 deliverable;
put it in `docs/release-checklist.md` next to the templates.

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
```

Failures: file an adapter fix against its fixture set and re-run the fixture
contract tests — never loosen validation.

---

## 5. Closing the MVP

After 7.5 / 8.4 / 13.3 / 13.4 all pass:

1. Mark the four tasks `[x]` in
   `openspec/changes/establish-chatstash-mvp/tasks.md`.
2. Fill the release-checklist header ("Not yet a store release" section) to
   reflect the completed smoke runs.
3. Run the final gate suite (release-checklist "Automated gates" block:
   frozen install, format/lint/typecheck/test, `supabase db reset` +
   `db lint --level warning` + `test db`, web + extension production builds,
   OpenSpec strict validation).
4. Run the OpenSpec verify/sync/archive flow for
   `establish-chatstash-mvp` and commit.

