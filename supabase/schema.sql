create table if not exists public.goose_profiles (
  email text primary key,
  interests text[] not null default '{}',
  contexts text[] not null default '{}',
  age text,
  gender text,
  income text,
  education text,
  race text[] not null default '{}',
  location text,
  employment text,
  family text,
  digest_enabled boolean not null default true,
  digest_frequency text not null default 'Weekly',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.goose_profiles enable row level security;

create policy "goose_profiles_select_for_demo"
on public.goose_profiles
for select
to anon
using (true);

create policy "goose_profiles_insert_for_demo"
on public.goose_profiles
for insert
to anon
with check (true);

create policy "goose_profiles_update_for_demo"
on public.goose_profiles
for update
to anon
using (true)
with check (true);