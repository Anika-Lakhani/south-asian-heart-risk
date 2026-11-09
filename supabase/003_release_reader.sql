-- Run once in Supabase's SQL Editor.
-- With "Automatically expose new tables" off, even the secret key's role
-- (service_role) gets no access to new tables. The release script needs to read
-- donations, so grant that role read access. The website's role is unchanged:
-- it still can't read anything.

grant usage on schema public to service_role;
grant select on public.donations to service_role;
