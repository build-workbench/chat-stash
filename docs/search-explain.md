# Search EXPLAIN (task 11.5)

Recorded 2026-08-18 against local Supabase Postgres 17.6 with
`supabase/scripts/explain-search.sql` (transaction rolled back).

Seed: 2000 owned conversations × 2 messages for user A, plus 1 conversation for
user B. Query `React` / `profiling`. No planner knobs were applied to production
SQL.

## Owner filter (list)

`conversations` ordered by `saved_at DESC, id DESC` uses
`conversations_user_saved_idx` with `Index Cond: (user_id = …)`. 31-row page:
~0.1 ms, 4 shared hits.

## Search RPC

`SELECT * FROM search_conversations_v1('React')` is a `Function Scan`
(~8–10 ms, ~700 shared hits, 30 rows). PL/pgSQL hides inner nodes.

At this sample size the inlined owner+FTS+`LIKE '%…%'` OR prefers a sequential
scan. That is expected; do not retune for it.

## FTS / trigram index paths (available)

With `enable_seqscan = off` and no owner predicate (so the GIN indexes can be
chosen), the planner uses:

| Predicate | Index |
| --- | --- |
| `title_tsv @@ websearch_to_tsquery('simple', 'React')` | `conversations_title_tsv_idx` Bitmap Index Scan, 41 rows, ~0.6 ms |
| `lower(title) LIKE '%react%'` | `conversations_title_trgm_idx` Bitmap Index Scan, 41 rows, ~1.1 ms |
| `content_tsv @@ websearch_to_tsquery('simple', 'profiling')` | `messages_content_tsv_idx` Bitmap Index Scan, 40 rows, ~1.0 ms |

Owner isolation remains `auth.uid()` inside the RPC (`security invoker` + RLS).
User B’s `React Secret` row is not returned for user A (covered by pgTAP).
