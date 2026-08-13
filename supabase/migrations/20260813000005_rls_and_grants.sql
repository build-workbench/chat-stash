-- ChatStash: row level security and explicit minimum grants.

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tags enable row level security;
alter table public.conversation_tags enable row level security;

revoke all on table public.profiles from public, anon;
revoke all on table public.folders from public, anon;
revoke all on table public.conversations from public, anon;
revoke all on table public.messages from public, anon;
revoke all on table public.tags from public, anon;
revoke all on table public.conversation_tags from public, anon;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy folders_select_own
  on public.folders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy folders_insert_own
  on public.folders for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy folders_update_own
  on public.folders for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy conversations_select_own
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy conversations_update_own
  on public.conversations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy conversations_delete_own
  on public.conversations for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy messages_select_own
  on public.messages for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy tags_select_own
  on public.tags for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy tags_insert_own
  on public.tags for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy tags_update_own
  on public.tags for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy tags_delete_own
  on public.tags for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy conversation_tags_select_own
  on public.conversation_tags for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy conversation_tags_insert_own
  on public.conversation_tags for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy conversation_tags_delete_own
  on public.conversation_tags for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.profiles to authenticated;

grant select, insert, update on public.folders to authenticated;

grant select on public.conversations to authenticated;
grant update (folder_id) on public.conversations to authenticated;
grant delete on public.conversations to authenticated;

grant select on public.messages to authenticated;

grant select, insert, update (name) on public.tags to authenticated;
grant delete on public.tags to authenticated;

grant select, insert, delete on public.conversation_tags to authenticated;
