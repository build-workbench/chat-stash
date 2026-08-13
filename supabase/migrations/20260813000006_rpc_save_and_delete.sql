-- ChatStash: atomic capture and non-destructive folder deletion RPCs.

create or replace function public.save_capture_v1(
  p_source_platform public.source_platform,
  p_source_url text,
  p_title text,
  p_user_markdown text,
  p_assistant_markdown text,
  p_source_conversation_id text default null,
  p_source_message_id text default null
)
returns table (conversation_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(p_title);
  v_user_markdown text := btrim(p_user_markdown);
  v_assistant_markdown text := btrim(p_assistant_markdown);
  v_dedupe_input text;
  v_dedupe_key text;
  v_existing uuid;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001';
  end if;

  if length(v_title) not between 1 and 240 then
    raise exception 'INVALID_TITLE'
      using errcode = 'P0001';
  end if;

  if length(p_source_url) not between 1 and 2048
     or p_source_url !~ '^https://'
     or p_source_url ~ '[[:cntrl:]]' then
    raise exception 'INVALID_SOURCE_URL'
      using errcode = 'P0001';
  end if;

  if p_source_platform = 'chatgpt' and p_source_url !~ '^https://chatgpt\.com/' then
    raise exception 'INVALID_SOURCE_URL'
      using errcode = 'P0001';
  end if;

  if p_source_platform = 'deepseek' and p_source_url !~ '^https://chat\.deepseek\.com/' then
    raise exception 'INVALID_SOURCE_URL'
      using errcode = 'P0001';
  end if;

  if p_source_conversation_id is not null
     and (length(p_source_conversation_id) not between 1 and 512
          or p_source_conversation_id ~ '[[:cntrl:]]') then
    raise exception 'INVALID_SOURCE_CONVERSATION_ID'
      using errcode = 'P0001';
  end if;

  if p_source_message_id is not null
     and (length(p_source_message_id) not between 1 and 512
          or p_source_message_id ~ '[[:cntrl:]]') then
    raise exception 'INVALID_SOURCE_MESSAGE_ID'
      using errcode = 'P0001';
  end if;

  if length(v_user_markdown) < 1 or length(v_user_markdown) > 500000 then
    raise exception 'INVALID_USER_MESSAGE'
      using errcode = 'P0001';
  end if;

  if length(v_assistant_markdown) < 1 or length(v_assistant_markdown) > 500000 then
    raise exception 'INVALID_ASSISTANT_MESSAGE'
      using errcode = 'P0001';
  end if;

  if p_source_message_id is not null then
    v_dedupe_input := jsonb_build_array(
      'v1', 'source', p_source_platform, p_source_conversation_id, p_source_message_id
    )::text;
  else
    v_dedupe_input := jsonb_build_array(
      'v1', 'content', p_source_platform, p_source_url, p_source_conversation_id,
      v_user_markdown, v_assistant_markdown
    )::text;
  end if;

  v_dedupe_key := encode(extensions.digest(v_dedupe_input, 'sha256'), 'hex');

  insert into public.conversations (
    user_id,
    source_platform,
    source_url,
    source_conversation_id,
    source_message_id,
    title,
    dedupe_key
  )
  values (
    v_user_id,
    p_source_platform,
    p_source_url,
    p_source_conversation_id,
    p_source_message_id,
    v_title,
    v_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select id into v_existing
    from public.conversations
    where user_id = v_user_id
      and dedupe_key = v_dedupe_key
    limit 1;

    if v_existing is null then
      raise exception 'SAVE_FAILED'
        using errcode = 'P0001';
    end if;

    return query select v_existing, 'duplicate'::text;
    return;
  end if;

  insert into public.messages (user_id, conversation_id, role, content_markdown, position)
  values
    (v_user_id, v_conversation_id, 'user', v_user_markdown, 0),
    (v_user_id, v_conversation_id, 'assistant', v_assistant_markdown, 1);

  return query select v_conversation_id, 'created'::text;
end;
$$;

revoke execute on function public.save_capture_v1(public.source_platform, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_capture_v1(public.source_platform, text, text, text, text, text, text) to authenticated;

create or replace function public.delete_folder_v1(p_folder_id uuid)
returns table (deleted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select parent_id into v_parent_id
  from public.folders
  where id = p_folder_id
    and user_id = v_user_id;

  if v_parent_id is null and not exists (
    select 1 from public.folders where id = p_folder_id and user_id = v_user_id
  ) then
    raise exception 'NOT_FOUND'
      using errcode = 'P0001';
  end if;

  begin
    update public.folders
    set parent_id = v_parent_id
    where parent_id = p_folder_id
      and user_id = v_user_id;

    update public.conversations
    set folder_id = null
    where folder_id = p_folder_id
      and user_id = v_user_id;

    delete from public.folders
    where id = p_folder_id
      and user_id = v_user_id;
  exception
    when unique_violation then
      raise exception 'FOLDER_NAME_CONFLICT'
        using errcode = 'P0001';
  end;

  return query select true;
end;
$$;

revoke execute on function public.delete_folder_v1(uuid) from public, anon;
grant execute on function public.delete_folder_v1(uuid) to authenticated;
