-- Representative EXPLAIN for search_conversations_v1 (task 11.5).
-- Seeds ~2000 owned conversations plus a second-user row, then prints plans.
-- Intended to run against local Supabase and roll back.

begin;

create extension if not exists pgcrypto;

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
)
values
  (
    '00000000-0000-4000-8000-00000000011a',
    'explain-a@example.com',
    'x',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  ),
  (
    '00000000-0000-4000-8000-00000000011b',
    'explain-b@example.com',
    'x',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    'authenticated',
    'authenticated'
  )
on conflict (id) do nothing;

insert into public.conversations (
  user_id,
  source_platform,
  source_url,
  title,
  dedupe_key,
  saved_at
)
select
  '00000000-0000-4000-8000-00000000011a',
  'chatgpt',
  'https://chatgpt.com/c/explain-' || i::text,
  case
    when i % 50 = 0 then 'React Performance ' || i::text
    when i % 17 = 0 then '中国历史 ' || i::text
    else 'Notebook notes ' || i::text
  end,
  lpad(to_hex(i), 64, '0'),
  timestamptz '2026-01-01 00:00:00+00' + (i || ' seconds')::interval
from generate_series(1, 2000) as i
on conflict do nothing;

insert into public.messages (user_id, conversation_id, role, content_markdown, position)
select
  c.user_id,
  c.id,
  'user',
  case
    when c.title like 'React%' then 'How do I optimize React rendering?'
    when c.title like '中国%' then '什么是明朝？'
    else 'Write a note about topic ' || c.title
  end,
  0
from public.conversations c
where c.user_id = '00000000-0000-4000-8000-00000000011a'
  and not exists (
    select 1 from public.messages m where m.conversation_id = c.id and m.position = 0
  );

insert into public.messages (user_id, conversation_id, role, content_markdown, position)
select
  c.user_id,
  c.id,
  'assistant',
  case
    when c.title like 'React%' then 'Use React.memo and profiling tools.'
    when c.title like '中国%' then '明朝是中国的一个朝代。'
    else 'Placeholder assistant body for ' || c.title
  end,
  1
from public.conversations c
where c.user_id = '00000000-0000-4000-8000-00000000011a'
  and not exists (
    select 1 from public.messages m where m.conversation_id = c.id and m.position = 1
  );

insert into public.conversations (
  user_id, source_platform, source_url, title, dedupe_key
)
values (
  '00000000-0000-4000-8000-00000000011b',
  'chatgpt',
  'https://chatgpt.com/c/explain-secret',
  'React Secret',
  lpad('b', 64, '0')
)
on conflict do nothing;

analyze public.conversations;
analyze public.messages;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}',
  true
);

\echo '=== RPC search_conversations_v1 React ==='
explain (analyze, buffers, format text)
select * from public.search_conversations_v1('React');

\echo '=== list conversations owner+saved_at ==='
explain (analyze, buffers, format text)
select id, title, saved_at
from public.conversations
where user_id = '00000000-0000-4000-8000-00000000011a'
order by saved_at desc, id desc
limit 31;

\echo '=== inner FTS/trigram title match ==='
explain (analyze, buffers, format text)
select c.id
from public.conversations c
where c.user_id = '00000000-0000-4000-8000-00000000011a'
  and (
    c.title_tsv @@ websearch_to_tsquery('simple', 'React')
    or lower(c.title) like '%react%' escape '\'
  );

\echo '=== inner message FTS/trigram ==='
explain (analyze, buffers, format text)
select m.conversation_id
from public.messages m
where m.user_id = '00000000-0000-4000-8000-00000000011a'
  and (
    m.content_tsv @@ websearch_to_tsquery('simple', 'profiling')
    or lower(m.content_markdown) like '%profiling%' escape '\'
  );

-- Prove GIN paths exist. Combined owner+OR predicates at 2k rows prefer
-- seq scan or the user_id index; do not retune for that sample size.
reset role;
set local enable_seqscan = off;

\echo '=== title FTS GIN (no owner predicate) ==='
explain (analyze, buffers, format text)
select c.id
from public.conversations c
where c.title_tsv @@ websearch_to_tsquery('simple', 'React');

\echo '=== title trigram GIN (no owner predicate) ==='
explain (analyze, buffers, format text)
select c.id
from public.conversations c
where lower(c.title) like '%react%' escape '\';

\echo '=== message FTS GIN (no owner predicate) ==='
explain (analyze, buffers, format text)
select m.conversation_id
from public.messages m
where m.content_tsv @@ websearch_to_tsquery('simple', 'profiling');

rollback;
