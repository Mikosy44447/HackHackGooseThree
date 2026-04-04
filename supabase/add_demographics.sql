-- Run in Supabase SQL editor to add expanded demographic columns to goose_profiles.

alter table public.goose_profiles
  add column if not exists income     text,
  add column if not exists education  text,
  add column if not exists race       text[] not null default '{}',
  add column if not exists location   text,
  add column if not exists employment text,
  add column if not exists family     text;
