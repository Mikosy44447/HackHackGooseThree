create table if not exists public.bills (
  id text primary key,
  title text not null,
  summary text not null,
  status text not null,
  topics text[] not null default '{}',
  affected_groups text[] not null default '{}',
  pattern text not null,
  related_bill_ids text[] not null default '{}',
  official_source_label text not null,
  official_source_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.bills enable row level security;

drop policy if exists "bills_select_for_demo" on public.bills;
create policy "bills_select_for_demo"
on public.bills
for select
to anon
using (true);

drop policy if exists "bills_insert_for_demo" on public.bills;
create policy "bills_insert_for_demo"
on public.bills
for insert
to anon
with check (true);

drop policy if exists "bills_update_for_demo" on public.bills;
create policy "bills_update_for_demo"
on public.bills
for update
to anon
using (true)
with check (true);

insert into public.bills (
  id,
  title,
  summary,
  status,
  topics,
  affected_groups,
  pattern,
  related_bill_ids,
  official_source_label,
  official_source_url
)
values
(
  'hr3127',
  'Fairness to Freedom Act of 2025',
  'Would establish a right to government-funded counsel for people facing removal proceedings if they cannot afford representation.',
  'Introduced in House',
  array['Immigration', 'Civil Rights', 'Language Access'],
  array['Immigrant Families', 'Detained Immigrants', 'Limited English Proficiency Households'],
  'Fits a broader legislative pattern focused on due process protections in immigration proceedings, especially for vulnerable and lower-income noncitizens.',
  array['hr6397'],
  'GovInfo: H.R. 3127',
  'https://www.govinfo.gov/app/details/BILLS-119hr3127ih'
),
(
  'hr6397',
  'Dignity for Detained Immigrants Act',
  'Would set standards for facilities where noncitizens are detained in Department of Homeland Security custody.',
  'Introduced in House',
  array['Immigration', 'Detention', 'Civil Rights'],
  array['Detained Immigrants', 'Immigrant Families', 'Asylum Seekers'],
  'Fits a broader legislative pattern focused on detention conditions, immigrant rights, and oversight of federal immigration enforcement.',
  array['hr3127'],
  'GovInfo: H.R. 6397',
  'https://www.govinfo.gov/app/details/BILLS-119hr6397ih'
),
(
  'hr4806',
  'College Transparency Act',
  'Would establish a postsecondary student data system intended to improve information about college access, costs, completion, and outcomes.',
  'Introduced in House',
  array['Education', 'Higher Education', 'Data Transparency'],
  array['College Applicants', 'First-Generation Students', 'Middle Class Families'],
  'Fits a broader legislative pattern pushing for clearer higher-education data so students and families can compare cost, completion, and outcomes.',
  array['hr6502'],
  'GovInfo: H.R. 4806',
  'https://www.govinfo.gov/app/details/BILLS-119hr4806ih'
),
(
  'hr6502',
  'College Financial Aid Clarity Act of 2025',
  'Would require the Department of Education to develop requirements for how colleges format financial aid offer forms.',
  'Reported in House',
  array['Education', 'Higher Education', 'Financial Aid'],
  array['College Applicants', 'First-Generation Students', 'Middle Class Families'],
  'Fits a broader legislative pattern aimed at making college pricing and aid information easier for students and families to understand.',
  array['hr4806'],
  'GovInfo: H.R. 6502',
  'https://www.govinfo.gov/app/details/BILLS-119hr6502rh'
)
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  topics = excluded.topics,
  affected_groups = excluded.affected_groups,
  pattern = excluded.pattern,
  related_bill_ids = excluded.related_bill_ids,
  official_source_label = excluded.official_source_label,
  official_source_url = excluded.official_source_url,
  updated_at = timezone('utc', now());