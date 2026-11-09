-- Run once in Supabase's SQL Editor (after schema.sql).
-- Test donations (app_version starting with "test") shouldn't count as contributors.

create or replace function public.contributor_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct donation_id)
  from public.donations
  where app_version not like 'test%';
$$;
