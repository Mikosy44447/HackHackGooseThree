create table if not exists public.profile_audiences (
  id bigint generated always as identity primary key,
  profile_email text not null references public.goose_profiles(email) on delete cascade,
  audience_label text not null,
  normalized_audience_key text,
  source text not null default 'derived',
  confidence numeric not null default 1.0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_email, audience_label)
);

alter table public.profile_audiences enable row level security;

drop policy if exists "profile_audiences_select_for_demo" on public.profile_audiences;
create policy "profile_audiences_select_for_demo"
on public.profile_audiences
for select
to anon
using (true);

drop policy if exists "profile_audiences_insert_for_demo" on public.profile_audiences;
create policy "profile_audiences_insert_for_demo"
on public.profile_audiences
for insert
to anon
with check (true);

drop policy if exists "profile_audiences_update_for_demo" on public.profile_audiences;
create policy "profile_audiences_update_for_demo"
on public.profile_audiences
for update
to anon
using (true)
with check (true);

drop policy if exists "profile_audiences_delete_for_demo" on public.profile_audiences;
create policy "profile_audiences_delete_for_demo"
on public.profile_audiences
for delete
to anon
using (true);