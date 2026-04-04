create extension if not exists vector with schema extensions;

alter table public.bill_audiences
add column if not exists embedding extensions.vector(768);

alter table public.profile_audiences
add column if not exists embedding extensions.vector(768);

create index if not exists bill_audiences_embedding_idx
on public.bill_audiences
using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists profile_audiences_embedding_idx
on public.profile_audiences
using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_bill_audiences_for_profile(
  p_bill_id text,
  p_profile_email text,
  p_match_count int default 3
)
returns table (
  id bigint,
  bill_id text,
  audience_label_raw text,
  audience_rationale text,
  why_it_matters text,
  confidence numeric,
  normalized_audience_key text,
  semantic_score double precision
)
language sql
as $$
  with scored as (
    select
      ba.id,
      ba.bill_id,
      ba.audience_label_raw,
      ba.audience_rationale,
      ba.why_it_matters,
      ba.confidence,
      ba.normalized_audience_key,
      max(
        case
          when ba.embedding is not null and pa.embedding is not null
          then 1 - (ba.embedding <=> pa.embedding)
          else 0
        end
      ) as semantic_score
    from public.bill_audiences ba
    left join public.profile_audiences pa
      on pa.profile_email = p_profile_email
    where ba.bill_id = p_bill_id
    group by
      ba.id,
      ba.bill_id,
      ba.audience_label_raw,
      ba.audience_rationale,
      ba.why_it_matters,
      ba.confidence,
      ba.normalized_audience_key
  )
  select *
  from scored
  order by semantic_score desc, confidence desc
  limit p_match_count;
$$;