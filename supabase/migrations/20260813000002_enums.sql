-- ChatStash: platform and message role enums.

create type public.source_platform as enum ('chatgpt', 'deepseek');
create type public.message_role as enum ('user', 'assistant');
