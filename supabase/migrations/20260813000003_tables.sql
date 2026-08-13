-- ChatStash: core tables, constraints, and indexes.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  parent_id uuid,
  name text not null,
  name_normalized text not null generated always as (lower(btrim(name))) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_user_fk
    foreign key (user_id) references public.profiles (user_id) on delete cascade,
  constraint folders_user_id_unique
    unique (user_id, id),
  constraint folders_parent_fk
    foreign key (user_id, parent_id) references public.folders (user_id, id) on delete restrict,
  constraint folders_no_self_parent
    check (parent_id is null or parent_id <> id),
  constraint folders_name_check
    check (
      length(btrim(name)) between 1 and 80
      and name !~ '[[:cntrl:]]'
    )
);

create unique index folders_sibling_name_unique
  on public.folders (user_id, parent_id, name_normalized)
  nulls not distinct;

create index folders_user_tree_idx
  on public.folders (user_id, parent_id, sort_order, name_normalized, id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid,
  source_platform public.source_platform not null,
  source_url text not null,
  source_conversation_id text,
  source_message_id text,
  title text not null,
  dedupe_key text not null,
  title_tsv tsvector not null generated always as (to_tsvector('simple', coalesce(title, ''))) stored,
  created_at timestamptz not null default now(),
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_user_fk
    foreign key (user_id) references public.profiles (user_id) on delete cascade,
  constraint conversations_user_id_unique
    unique (user_id, id),
  constraint conversations_folder_fk
    foreign key (user_id, folder_id) references public.folders (user_id, id) on delete restrict,
  constraint conversations_title_check
    check (
      length(btrim(title)) between 1 and 240
      and title !~ '[[:cntrl:]]'
    ),
  constraint conversations_source_url_check
    check (
      length(source_url) between 1 and 2048
      and source_url ~ '^https://'
      and source_url !~ '[[:cntrl:]]'
    ),
  constraint conversations_source_ids_check
    check (
      (source_conversation_id is null or length(source_conversation_id) between 1 and 512)
      and (source_message_id is null or length(source_message_id) between 1 and 512)
      and (source_conversation_id is null or source_conversation_id !~ '[[:cntrl:]]')
      and (source_message_id is null or source_message_id !~ '[[:cntrl:]]')
    ),
  constraint conversations_dedupe_key_check
    check (dedupe_key ~ '^[0-9a-f]{64}$')
);

create unique index conversations_user_dedupe_key_unique
  on public.conversations (user_id, dedupe_key);

create index conversations_user_saved_idx
  on public.conversations (user_id, saved_at desc, id desc);

create index conversations_user_folder_saved_idx
  on public.conversations (user_id, folder_id, saved_at desc, id desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid not null,
  role public.message_role not null,
  content_markdown text not null,
  content_tsv tsvector not null generated always as (to_tsvector('simple', coalesce(content_markdown, ''))) stored,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint messages_user_fk
    foreign key (user_id) references public.profiles (user_id) on delete cascade,
  constraint messages_conversation_fk
    foreign key (user_id, conversation_id)
      references public.conversations (user_id, id)
      on delete cascade,
  constraint messages_role_position_check
    check (
      (role = 'user' and position = 0)
      or (role = 'assistant' and position = 1)
    ),
  constraint messages_content_check
    check (
      length(btrim(content_markdown)) > 0
      and length(content_markdown) <= 500000
    ),
  constraint messages_conversation_position_unique
    unique (conversation_id, position)
);

create index messages_user_conversation_idx
  on public.messages (user_id, conversation_id, position);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  name_normalized text not null generated always as (lower(btrim(name))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_user_fk
    foreign key (user_id) references public.profiles (user_id) on delete cascade,
  constraint tags_user_id_unique
    unique (user_id, id),
  constraint tags_name_check
    check (
      length(btrim(name)) between 1 and 80
      and name !~ '[[:cntrl:]]'
    ),
  constraint tags_user_name_normalized_unique
    unique (user_id, name_normalized)
);

create index tags_user_name_idx
  on public.tags (user_id, name_normalized, id);

create table public.conversation_tags (
  user_id uuid not null,
  conversation_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  constraint conversation_tags_pk
    primary key (user_id, conversation_id, tag_id),
  constraint conversation_tags_user_fk
    foreign key (user_id) references public.profiles (user_id) on delete cascade,
  constraint conversation_tags_conversation_fk
    foreign key (user_id, conversation_id)
      references public.conversations (user_id, id)
      on delete cascade,
  constraint conversation_tags_tag_fk
    foreign key (user_id, tag_id)
      references public.tags (user_id, id)
      on delete cascade
);

create index conversation_tags_user_tag_idx
  on public.conversation_tags (user_id, tag_id, conversation_id);
