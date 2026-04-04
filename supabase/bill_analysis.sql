create table if not exists public.bill_analysis (
  bill_id text primary key references public.bills(id) on delete cascade,
  why_it_matters_general text not null,
  broader_pattern text not null,
  hot_take text not null,
  analysis_version text not null default 'v1',
  model text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.bill_analysis enable row level security;

drop policy if exists "bill_analysis_select_for_demo" on public.bill_analysis;
create policy "bill_analysis_select_for_demo"
on public.bill_analysis
for select
to anon
using (true);

drop policy if exists "bill_analysis_insert_for_demo" on public.bill_analysis;
create policy "bill_analysis_insert_for_demo"
on public.bill_analysis
for insert
to anon
with check (true);

drop policy if exists "bill_analysis_update_for_demo" on public.bill_analysis;
create policy "bill_analysis_update_for_demo"
on public.bill_analysis
for update
to anon
using (true)
with check (true);