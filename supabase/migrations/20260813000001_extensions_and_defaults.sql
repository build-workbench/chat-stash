-- ChatStash: required extensions and explicit default privileges.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- New public-schema objects must be exposed only through explicit grants.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges in schema public
  revoke select, insert, update, delete on tables from public, anon, authenticated;

alter default privileges in schema public
  revoke usage, select on sequences from public, anon, authenticated;
