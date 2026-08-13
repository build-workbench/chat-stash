-- ChatStash: updated_at maintenance, profile bootstrap, and folder cycle guard.

create schema if not exists private;

create function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger folders_set_updated_at
before update on public.folders
for each row execute function private.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function private.set_updated_at();

create trigger tags_set_updated_at
before update on public.tags
for each row execute function private.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users that existed before this migration.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create function private.prevent_folder_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'FOLDER_CYCLE'
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  cursor_id := new.parent_id;
  loop
    select parent_id into cursor_id
    from public.folders
    where id = cursor_id
      and user_id = new.user_id;

    if cursor_id is null then
      exit;
    end if;

    if cursor_id = new.id then
      raise exception 'FOLDER_CYCLE'
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

create trigger folders_prevent_cycle
before insert or update of parent_id on public.folders
for each row execute function private.prevent_folder_cycle();
