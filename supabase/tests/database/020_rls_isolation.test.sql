begin;

select plan(14);

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
  ('00000000-0000-0000-0000-00000000000a', 'user-a@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'user-b@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select is(
  (select count(*)::bigint from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'user A sees own profile'
);

select is(
  (select count(*)::bigint from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint,
  'user A cannot see user B profile'
);

insert into public.folders (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'A Folder');

select is(
  (select count(*)::bigint from public.folders where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'user A can create and read own folder'
);

select ok(
  public.test_expects_error($$insert into public.folders (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'B Folder')$$),
  'user A cannot insert a folder owned by user B'
);

select ok(
  public.test_expects_error($$delete from public.folders where id = (select id from public.folders where user_id = '00000000-0000-0000-0000-00000000000a' limit 1)$$),
  'authenticated user cannot bypass delete_folder_v1 with direct DELETE'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is(
  (select count(*)::bigint from public.folders),
  0::bigint,
  'user B sees no folders owned by user A'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

insert into public.tags (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'react');
insert into public.tags (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'typescript');

select is(
  (select count(*)::bigint from public.tags),
  2::bigint,
  'user A can manage own tags'
);

select ok(
  not public.test_expects_error($$update public.tags set name = 'unique-a' where name = 'react'$$),
  'user A can rename own tag to a valid unique name'
);

select ok(
  public.test_expects_error($$update public.tags set name = 'typescript' where name = 'unique-a'$$),
  'duplicate normalized tag names are rejected'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select is(
  (select count(*)::bigint from public.tags),
  0::bigint,
  'user B sees no tags owned by user A'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

select ok(
  public.test_expects_error($$insert into public.conversations (user_id, source_platform, source_url, title, dedupe_key) values ('00000000-0000-0000-0000-00000000000a', 'chatgpt', 'https://chatgpt.com/c/x', 'T', repeat('a', 64))$$),
  'authenticated user cannot insert conversations directly; only save_capture_v1 can'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

select ok(
  public.test_expects_error($$insert into public.conversation_tags (user_id, conversation_id, tag_id) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')$$),
  'cross-user conversation/tag relationship is rejected'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select ok(
  public.test_expects_error($$select count(*) from public.conversations$$),
  'anon role cannot query user conversations'
);

select ok(
  public.test_expects_error($$select public.save_capture_v1('chatgpt', 'https://chatgpt.com/c/x', 'T', 'u', 'a')$$),
  'anon role cannot execute save_capture_v1'
);

select * from finish();
rollback;
