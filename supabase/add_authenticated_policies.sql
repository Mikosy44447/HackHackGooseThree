-- The existing RLS policies are scoped to `anon` only.
-- After adding Supabase Auth, logged-in users make requests as `authenticated`,
-- which the current policies do not cover. This migration adds matching permissive
-- policies for the `authenticated` role on all tables.

-- goose_profiles
create policy "goose_profiles_select_authenticated"
  on public.goose_profiles for select to authenticated using (true);

create policy "goose_profiles_insert_authenticated"
  on public.goose_profiles for insert to authenticated with check (true);

create policy "goose_profiles_update_authenticated"
  on public.goose_profiles for update to authenticated using (true) with check (true);

-- bills
create policy "bills_select_authenticated"
  on public.bills for select to authenticated using (true);

create policy "bills_insert_authenticated"
  on public.bills for insert to authenticated with check (true);

create policy "bills_update_authenticated"
  on public.bills for update to authenticated using (true) with check (true);

-- bill_audiences
create policy "bill_audiences_select_authenticated"
  on public.bill_audiences for select to authenticated using (true);

create policy "bill_audiences_insert_authenticated"
  on public.bill_audiences for insert to authenticated with check (true);

create policy "bill_audiences_update_authenticated"
  on public.bill_audiences for update to authenticated using (true) with check (true);

create policy "bill_audiences_delete_authenticated"
  on public.bill_audiences for delete to authenticated using (true);

-- profile_audiences
create policy "profile_audiences_select_authenticated"
  on public.profile_audiences for select to authenticated using (true);

create policy "profile_audiences_insert_authenticated"
  on public.profile_audiences for insert to authenticated with check (true);

create policy "profile_audiences_update_authenticated"
  on public.profile_audiences for update to authenticated using (true) with check (true);

create policy "profile_audiences_delete_authenticated"
  on public.profile_audiences for delete to authenticated using (true);

-- bill_analysis
create policy "bill_analysis_select_authenticated"
  on public.bill_analysis for select to authenticated using (true);

create policy "bill_analysis_insert_authenticated"
  on public.bill_analysis for insert to authenticated with check (true);

create policy "bill_analysis_update_authenticated"
  on public.bill_analysis for update to authenticated using (true) with check (true);
