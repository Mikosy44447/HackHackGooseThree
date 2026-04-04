-- Run this in the Supabase SQL editor to enable Supabase Auth alongside goose_profiles.
--
-- Supabase Auth manages its own `auth.users` table automatically — no schema changes
-- needed there. This migration just ensures goose_profiles stays in sync by making
-- email the join key between auth.users and goose_profiles.
--
-- After running this, go to Supabase Dashboard → Authentication → Providers and
-- ensure "Email" is enabled. To skip email confirmation during development, go to
-- Authentication → Settings and disable "Enable email confirmations".

-- No schema change required: goose_profiles.email is already the primary key and
-- will continue to serve as the link to auth.users.email.

-- Optional: tighten RLS so users can only read/write their own profile.
-- Uncomment the lines below once Supabase Auth is confirmed working.

-- drop policy if exists "goose_profiles_select_for_demo" on public.goose_profiles;
-- drop policy if exists "goose_profiles_insert_for_demo" on public.goose_profiles;
-- drop policy if exists "goose_profiles_update_for_demo" on public.goose_profiles;

-- create policy "goose_profiles_select_own"
-- on public.goose_profiles for select to authenticated
-- using (email = auth.jwt() ->> 'email');

-- create policy "goose_profiles_insert_own"
-- on public.goose_profiles for insert to authenticated
-- with check (email = auth.jwt() ->> 'email');

-- create policy "goose_profiles_update_own"
-- on public.goose_profiles for update to authenticated
-- using (email = auth.jwt() ->> 'email')
-- with check (email = auth.jwt() ->> 'email');
