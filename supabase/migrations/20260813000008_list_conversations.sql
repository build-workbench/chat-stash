-- ChatStash: cursor-based list RPC to avoid client-side IN + max_rows truncation.

create or replace function public.list_conversations_v1(
  p_folder_id uuid default null,
  p_tag_id uuid default null,
  p_after_saved_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 30
)
returns table (
  conversation_id uuid,
  title text,
  source_platform public.source_platform,
  source_url text,
  folder_id uuid,
  saved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(p_limit, 1), 100);
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select
    c.id,
    c.title,
    c.source_platform,
    c.source_url,
    c.folder_id,
    c.saved_at
  from public.conversations c
  where c.user_id = v_user_id
    and (p_folder_id is null or c.folder_id = p_folder_id)
    and (
      p_tag_id is null
      or exists (
        select 1
        from public.conversation_tags ct
        where ct.user_id = c.user_id
          and ct.conversation_id = c.id
          and ct.tag_id = p_tag_id
      )
    )
    and (
      p_after_saved_at is null
      or c.saved_at < p_after_saved_at
      or (c.saved_at = p_after_saved_at and c.id < p_after_id)
    )
  order by c.saved_at desc, c.id desc
  limit v_limit;
end;
$$;

revoke execute on function public.list_conversations_v1(uuid, uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_conversations_v1(uuid, uuid, timestamptz, uuid, integer) to authenticated;
