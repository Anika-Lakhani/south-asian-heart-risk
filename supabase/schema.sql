-- Anonymous data donations for the heart-risk app.
--
-- Paste this whole file into Supabase's SQL Editor and click Run.
--
-- Security model: the public website can ADD rows and nothing else. It can't read,
-- change, or delete anyone's answers. Only a contributor count is public. Reading
-- rows (to build the anonymized public releases) needs the secret key, which never
-- goes in the website.

create table public.donations (
  id bigint generated always as identity primary key,
  -- Random ID linking one person's sections; generated in the browser, not derived
  -- from anything about them.
  donation_id uuid not null,
  module text not null check (module in ('core', 'southAsian', 'context')),
  answers jsonb not null check (
    jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 8192
  ),
  app_version text not null check (char_length(app_version) <= 40),
  -- Month only, set by the database, so exact submission times are never stored.
  received_month date not null default date_trunc('month', now())::date,
  -- Each section can be saved once per donation, so double-clicks don't duplicate.
  unique (donation_id, module)
);

alter table public.donations enable row level security;

-- The website may insert only these columns; received_month always comes from the
-- database default, so it can't be faked. Granted explicitly, so this works even
-- with "Automatically expose new tables" turned off.
grant usage on schema public to anon;
revoke all on public.donations from anon, authenticated;
grant insert (donation_id, module, answers, app_version) on public.donations to anon;

create policy "Anyone can add a donation"
  on public.donations for insert to anon
  with check (true);

-- No select, update, or delete policies exist, so the website can't do any of those.

-- The one public number: how many people have contributed (test entries excluded).
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

revoke all on function public.contributor_count() from public;
grant execute on function public.contributor_count() to anon;
