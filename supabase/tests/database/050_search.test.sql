begin;

select plan(16);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000030a', 'search-a@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000030b', 'search-b@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000030a"}', true);

select public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/search-one',
  p_title => 'React Performance',
  p_user_markdown => 'How do I optimize React rendering?',
  p_assistant_markdown => 'Use React.memo and profiling tools.'
);

select public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/search-two',
  p_title => '中国历史',
  p_user_markdown => '什么是明朝？',
  p_assistant_markdown => '明朝是中国的一个朝代。'
);

select public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/search-three',
  p_title => 'Python Script',
  p_user_markdown => 'def main():',
  p_assistant_markdown => 'print hello world'
);

select public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/search-four',
  p_title => 'React Native',
  p_user_markdown => 'Explain React Native',
  p_assistant_markdown => 'React Native renders native components.'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000030b"}', true);
select public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/search-b',
  p_title => 'React Secret',
  p_user_markdown => 'Private React plan',
  p_assistant_markdown => 'This must stay private.'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000030a"}', true);

select is(
  (select count(*)::bigint from public.search_conversations_v1('React')),
  2::bigint,
  'English title search returns owned matches'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('react')),
  2::bigint,
  'search is case-insensitive'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('profiling')),
  1::bigint,
  'message body search returns the matching conversation'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('明朝')),
  1::bigint,
  'Chinese substring search returns the matching conversation'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('def')),
  1::bigint,
  'code-like literal search returns the matching conversation'
);

select is(
  (select min(rank) from public.search_conversations_v1('React')),
  2.0::real,
  'title matches rank above body-only matches'
);

insert into public.folders (user_id, name)
values
  ('00000000-0000-0000-0000-00000000030a', 'React Folder'),
  ('00000000-0000-0000-0000-00000000030a', 'Empty Folder');

update public.conversations
set folder_id = (
  select id from public.folders where user_id = '00000000-0000-0000-0000-00000000030a' and name = 'React Folder'
)
where source_url = 'https://chatgpt.com/c/search-one';

select is(
  (select count(*)::bigint from public.search_conversations_v1(
    'React',
    p_folder_id => (select id from public.folders where name = 'React Folder')
  )),
  1::bigint,
  'search respects the active folder filter'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1(
    'React',
    p_folder_id => (select id from public.folders where name = 'Empty Folder')
  )),
  0::bigint,
  'search returns no results for an empty folder filter'
);

insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-00000000030a', 'perf');

insert into public.conversation_tags (user_id, conversation_id, tag_id)
select '00000000-0000-0000-0000-00000000030a', id, (select id from public.tags where name = 'perf')
from public.conversations
where source_url = 'https://chatgpt.com/c/search-one';

select is(
  (select count(*)::bigint from public.search_conversations_v1(
    'React',
    p_folder_id => (select id from public.folders where name = 'React Folder'),
    p_tag_id => (select id from public.tags where name = 'perf')
  )),
  1::bigint,
  'search combines folder and tag filters'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('"react" -nothing')),
  2::bigint,
  'web-search style punctuation is parsed safely'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('React Secret')),
  0::bigint,
  'search never returns another user content'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('React')
    where conversation_id = (select id from public.conversations where source_url = 'https://chatgpt.com/c/search-one')),
  1::bigint,
  'a conversation matching title and body appears exactly once'
);

create temp table page1 as
select * from public.search_conversations_v1('React', p_limit => 1);

create temp table page2 as
select * from public.search_conversations_v1(
  'React',
  p_limit => 1,
  p_after_rank => (select rank from page1),
  p_after_saved_at => (select saved_at from page1),
  p_after_id => (select conversation_id from page1)
);

select is(
  (select count(*)::bigint from page1),
  1::bigint,
  'search cursor returns one first-page row'
);

select is(
  (select count(*)::bigint from page2),
  1::bigint,
  'search cursor returns one next-page row'
);

select is(
  (select count(*)::bigint from page1 p1 join page2 p2 on p1.conversation_id = p2.conversation_id),
  0::bigint,
  'search cursor pages do not overlap'
);

select is(
  (select count(*)::bigint from public.search_conversations_v1('')),
  0::bigint,
  'empty query returns no results'
);

select * from finish();
rollback;
