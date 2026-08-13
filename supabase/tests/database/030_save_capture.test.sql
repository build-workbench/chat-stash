begin;

select plan(19);

create or replace function public.test_expects_error(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception
  when others then
    return true;
end;
$$;

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000010a', 'save-a@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000010b', 'save-b@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000010a"}', true);

create temp table save_result (
  id bigserial primary key,
  conversation_id uuid,
  outcome text
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/abc',
  p_source_conversation_id => 'conv-1',
  p_source_message_id => 'msg-1',
  p_title => 'Title One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

select is(
  (select outcome from save_result where id = 1),
  'created',
  'first capture is created'
);

select is(
  (select count(*)::bigint from public.messages
    where conversation_id = (select conversation_id from save_result where id = 1)
      and (
        (role = 'user' and position = 0)
        or (role = 'assistant' and position = 1)
      )),
  2::bigint,
  'created snapshot has exactly one user and one assistant message'
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/abc',
  p_source_conversation_id => 'conv-1',
  p_source_message_id => 'msg-1',
  p_title => 'Title One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

select is(
  (select outcome from save_result where id = 2),
  'duplicate',
  'same source message id returns duplicate outcome'
);

select is(
  (select conversation_id from save_result where id = 2),
  (select conversation_id from save_result where id = 1),
  'duplicate returns the existing conversation id via the unique-conflict path used by concurrent retries'
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/abc',
  p_source_conversation_id => 'conv-1',
  p_title => 'Title One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

select is(
  (select outcome from save_result where id = 3),
  'created',
  'content-only capture without a source id is a distinct snapshot identity'
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/abc',
  p_source_conversation_id => 'conv-1',
  p_title => 'Title One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

select is(
  (select outcome from save_result where id = 4),
  'duplicate',
  'content-based fallback detects a duplicate when no source message id exists'
);

select is(
  (select count(*)::bigint from public.messages
    where conversation_id = (select conversation_id from save_result where id = 1)),
  2::bigint,
  'duplicate attempts do not add messages'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000010b"}', true);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/abc',
  p_source_conversation_id => 'conv-1',
  p_source_message_id => 'msg-1',
  p_title => 'Title One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

select is(
  (select count(*)::bigint from public.messages
    where user_id = '00000000-0000-0000-0000-00000000010b'),
  2::bigint,
  'same source response saved by another user gets its own snapshot'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000010a"}', true);

select ok(
  public.test_expects_error($$select public.save_capture_v1('chatgpt', 'https://example.com/c/1', 'T', 'u', 'a')$$),
  'unsupported canonical host is rejected'
);

select ok(
  public.test_expects_error($$select public.save_capture_v1('chatgpt', 'https://chatgpt.com/c/abc', 'T', 'u', '')$$),
  'empty assistant markdown is rejected'
);

select is(
  (select count(*)::bigint from public.messages
    where conversation_id = (select conversation_id from save_result where id = 1)),
  2::bigint,
  'failed captures leave no partial or extra rows'
);

insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-00000000010a', 'cascade-tag');

insert into public.conversation_tags (user_id, conversation_id, tag_id)
select '00000000-0000-0000-0000-00000000010a', (select conversation_id from save_result where id = 1), id
from public.tags
where name = 'cascade-tag';

delete from public.conversations
where id = (select conversation_id from save_result where id = 1);

select is(
  (select count(*)::bigint from public.messages
    where conversation_id = (select conversation_id from save_result where id = 1)),
  0::bigint,
  'deleting a conversation cascades its messages'
);

select is(
  (select count(*)::bigint from public.conversation_tags where user_id = '00000000-0000-0000-0000-00000000010a'),
  0::bigint,
  'deleting a conversation cascades its tag relationships'
);

select is(
  (select count(*)::bigint from public.tags where name = 'cascade-tag'),
  1::bigint,
  'deleting a conversation preserves the tag definition'
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/def',
  p_title => 'Title Two',
  p_user_markdown => 'Prompt two',
  p_assistant_markdown => 'Response two'
);

insert into public.conversation_tags (user_id, conversation_id, tag_id)
select '00000000-0000-0000-0000-00000000010a', (select conversation_id from save_result where id = 6), id
from public.tags
where name = 'cascade-tag';

delete from public.tags
where name = 'cascade-tag';

select is(
  (select count(*)::bigint from public.conversation_tags where user_id = '00000000-0000-0000-0000-00000000010a'),
  0::bigint,
  'deleting a tag cascades its relationships'
);

select is(
  (select count(*)::bigint from public.conversations where id = (select conversation_id from save_result where id = 6)),
  1::bigint,
  'deleting a tag preserves the conversation'
);

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000010a';

select is(
  (select count(*)::bigint from public.profiles where user_id = '00000000-0000-0000-0000-00000000010a'),
  0::bigint,
  'deleting an auth user cascades the profile'
);

select is(
  (select count(*)::bigint from public.conversations where user_id = '00000000-0000-0000-0000-00000000010a'),
  0::bigint,
  'deleting an auth user cascades conversations'
);

select is(
  (select count(*)::bigint from public.tags where user_id = '00000000-0000-0000-0000-00000000010a'),
  0::bigint,
  'deleting an auth user cascades tags'
);

select * from finish();
rollback;
