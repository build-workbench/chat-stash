begin;

select plan(15);

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
  ('00000000-0000-0000-0000-00000000020a', 'folder-a@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000020b', 'folder-b@example.com', 'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000020a"}', true);

insert into public.folders (id, user_id, parent_id, name)
values
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-00000000020a', null, 'R'),
  ('00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a1', 'P'),
  ('00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a2', 'child'),
  ('00000000-0000-0000-0000-0000000002a4', '00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a1', 'dup');

select is(
  (select count(*)::bigint from public.folders where user_id = '00000000-0000-0000-0000-00000000020a'),
  4::bigint,
  'nested folder tree is created'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000020b"}', true);
insert into public.folders (id, user_id, name)
values ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-00000000020b', 'B Root');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000020a"}', true);

select ok(
  public.test_expects_error($$update public.folders set parent_id = '00000000-0000-0000-0000-0000000002a3' where id = '00000000-0000-0000-0000-0000000002a2'$$),
  'moving a folder below its descendant is rejected'
);

select ok(
  public.test_expects_error($$update public.folders set parent_id = id where id = '00000000-0000-0000-0000-0000000002a2'$$),
  'folder cannot be its own parent'
);

select ok(
  public.test_expects_error($$update public.folders set parent_id = '00000000-0000-0000-0000-0000000002b1' where id = '00000000-0000-0000-0000-0000000002a2'$$),
  'folder cannot use another user as parent'
);

update public.folders
set parent_id = '00000000-0000-0000-0000-0000000002a1'
where id = '00000000-0000-0000-0000-0000000002a3';

select is(
  (select parent_id from public.folders where id = '00000000-0000-0000-0000-0000000002a3'),
  '00000000-0000-0000-0000-0000000002a1'::uuid,
  'valid reparent of a grandchild to root succeeds'
);

create temp table save_result (
  id bigserial primary key,
  conversation_id uuid,
  outcome text
);

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/folder-one',
  p_title => 'Folder Conversation One',
  p_user_markdown => 'Prompt one',
  p_assistant_markdown => 'Response one'
);

update public.conversations
set folder_id = '00000000-0000-0000-0000-0000000002a2'
where id = (select conversation_id from save_result where id = 1);

select * from public.delete_folder_v1('00000000-0000-0000-0000-0000000002a2');

select is(
  (select count(*)::bigint from public.folders where id = '00000000-0000-0000-0000-0000000002a2'),
  0::bigint,
  'delete_folder_v1 removes the folder'
);

select is(
  (select folder_id from public.conversations where id = (select conversation_id from save_result where id = 1)),
  null,
  'deleting a folder moves its conversations to All Saves'
);

select is(
  (select count(*)::bigint from public.conversations where id = (select conversation_id from save_result where id = 1)),
  1::bigint,
  'deleting a folder never deletes conversations'
);

insert into public.folders (id, user_id, parent_id, name)
values
  ('00000000-0000-0000-0000-0000000002a5', '00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a1', 'P2'),
  ('00000000-0000-0000-0000-0000000002a6', '00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a5', 'dup');

insert into save_result (conversation_id, outcome)
select * from public.save_capture_v1(
  p_source_platform => 'chatgpt',
  p_source_url => 'https://chatgpt.com/c/folder-two',
  p_title => 'Folder Conversation Two',
  p_user_markdown => 'Prompt two',
  p_assistant_markdown => 'Response two'
);

update public.conversations
set folder_id = '00000000-0000-0000-0000-0000000002a5'
where id = (select conversation_id from save_result where id = 2);

select ok(
  public.test_expects_error($$select * from public.delete_folder_v1('00000000-0000-0000-0000-0000000002a5')$$),
  'folder delete with a sibling-name conflict is rejected'
);

select is(
  (select count(*)::bigint from public.folders where id = '00000000-0000-0000-0000-0000000002a5'),
  1::bigint,
  'conflicting folder delete rolls back the folder removal'
);

select is(
  (select parent_id from public.folders where id = '00000000-0000-0000-0000-0000000002a6'),
  '00000000-0000-0000-0000-0000000002a5'::uuid,
  'conflicting folder delete preserves child hierarchy'
);

select is(
  (select folder_id from public.conversations where id = (select conversation_id from save_result where id = 2)),
  '00000000-0000-0000-0000-0000000002a5'::uuid,
  'conflicting folder delete preserves conversation assignment'
);

select ok(
  public.test_expects_error($$delete from public.folders where id = '00000000-0000-0000-0000-0000000002a5'$$),
  'direct folder DELETE remains blocked'
);

select * from public.delete_folder_v1('00000000-0000-0000-0000-0000000002a1');

select ok(
  (select count(*)::bigint from public.folders
    where id in ('00000000-0000-0000-0000-0000000002a4', '00000000-0000-0000-0000-0000000002a5')
      and parent_id is null) = 2::bigint,
  'deleting a root folder promotes its direct children to root'
);

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000020a';

select is(
  (select count(*)::bigint from public.folders where user_id = '00000000-0000-0000-0000-00000000020a'),
  0::bigint,
  'deleting an auth user cascades folders'
);

select * from finish();
rollback;
