-- ChatStash: search indexes and owned conversation search RPC.

create index conversations_title_tsv_idx
  on public.conversations using gin (title_tsv);

create index messages_content_tsv_idx
  on public.messages using gin (content_tsv);

create index conversations_title_trgm_idx
  on public.conversations using gin (lower(title) gin_trgm_ops);

create index messages_content_trgm_idx
  on public.messages using gin (lower(content_markdown) gin_trgm_ops);

create or replace function public.search_conversations_v1(
  p_query text,
  p_folder_id uuid default null,
  p_tag_id uuid default null,
  p_after_rank real default null,
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
  saved_at timestamptz,
  rank real
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := btrim(p_query);
  v_like text;
  v_tsquery tsquery;
  v_limit integer := least(greatest(p_limit, 1), 100);
begin
  if v_user_id is null or v_query = '' then
    return;
  end if;

  v_like := '%' ||
    replace(replace(replace(lower(v_query), '\', '\\'), '%', '\%'), '_', '\_') ||
    '%';
  v_tsquery := websearch_to_tsquery('simple', v_query);

  return query
  with matches as (
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
        c.title_tsv @@ v_tsquery
        or lower(c.title) like v_like escape '\'
        or exists (
          select 1
          from public.messages m
          where m.user_id = c.user_id
            and m.conversation_id = c.id
            and (
              m.content_tsv @@ v_tsquery
              or lower(m.content_markdown) like v_like escape '\'
            )
        )
      )
  ),
  ranked as (
    select
      m.*,
      case
        when lower(m.title) like v_like escape '\' then 2.0
        else 1.0
      end::real as rank
    from matches m
  )
  select
    r.id,
    r.title,
    r.source_platform,
    r.source_url,
    r.folder_id,
    r.saved_at,
    r.rank
  from ranked r
  where p_after_rank is null
     or r.rank < p_after_rank
     or (
       r.rank = p_after_rank
       and (
         r.saved_at < p_after_saved_at
         or (r.saved_at = p_after_saved_at and r.id < p_after_id)
       )
     )
  order by r.rank desc, r.saved_at desc, r.id desc
  limit v_limit;
end;
$$;

revoke execute on function public.search_conversations_v1(text, uuid, uuid, real, timestamptz, uuid, integer) from public, anon;
grant execute on function public.search_conversations_v1(text, uuid, uuid, real, timestamptz, uuid, integer) to authenticated;
