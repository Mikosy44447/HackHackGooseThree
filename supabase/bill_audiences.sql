create table if not exists public.bill_audiences (
  id bigint generated always as identity primary key,
  bill_id text not null references public.bills(id) on delete cascade,
  audience_label_raw text not null,
  audience_rationale text not null,
  why_it_matters text not null,
  confidence numeric not null,
  normalized_audience_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (bill_id, audience_label_raw)
);

alter table public.bill_audiences enable row level security;

drop policy if exists "bill_audiences_select_for_demo" on public.bill_audiences;
create policy "bill_audiences_select_for_demo"
on public.bill_audiences
for select
to anon
using (true);

drop policy if exists "bill_audiences_insert_for_demo" on public.bill_audiences;
create policy "bill_audiences_insert_for_demo"
on public.bill_audiences
for insert
to anon
with check (true);

drop policy if exists "bill_audiences_update_for_demo" on public.bill_audiences;
create policy "bill_audiences_update_for_demo"
on public.bill_audiences
for update
to anon
using (true)
with check (true);

drop policy if exists "bill_audiences_delete_for_demo" on public.bill_audiences;
create policy "bill_audiences_delete_for_demo"
on public.bill_audiences
for delete
to anon
using (true);