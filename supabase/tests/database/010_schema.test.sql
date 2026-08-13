begin;

select plan(21);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'folders', 'folders table exists');
select has_table('public', 'conversations', 'conversations table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'tags', 'tags table exists');
select has_table('public', 'conversation_tags', 'conversation_tags table exists');

select has_type('public', 'source_platform', 'source_platform enum exists');
select has_type('public', 'message_role', 'message_role enum exists');

select has_function('public', 'save_capture_v1', 'save_capture_v1 exists');
select has_function('public', 'delete_folder_v1', 'delete_folder_v1 exists');
select has_function('public', 'search_conversations_v1', 'search_conversations_v1 exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.folders'::regclass),
  true,
  'folders RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.conversations'::regclass),
  true,
  'conversations RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  true,
  'messages RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.tags'::regclass),
  true,
  'tags RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.conversation_tags'::regclass),
  true,
  'conversation_tags RLS enabled'
);

select has_index('public', 'conversations', 'conversations_user_dedupe_key_unique', 'conversation dedupe unique index exists');
select has_index('public', 'folders', 'folders_sibling_name_unique', 'folder sibling-name unique index exists');

select has_trigger('public', 'folders', 'folders_prevent_cycle', 'folder cycle trigger exists');
select has_trigger('auth', 'users', 'on_auth_user_created', 'profile bootstrap trigger exists');

select * from finish();
rollback;
