-- Run in Supabase SQL editor.

alter table public.bills
  add column if not exists content_type text not null default 'bill',
  add column if not exists sponsors     jsonb not null default '[]',
  add column if not exists agency       text;

alter table public.goose_profiles
  add column if not exists last_digest_sent_at timestamptz;

-- Index to efficiently query by content type
create index if not exists bills_content_type_idx on public.bills(content_type);
