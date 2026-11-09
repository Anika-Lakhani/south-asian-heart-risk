-- Run once in Supabase's SQL Editor, BEFORE testing the "donate" function.
-- The function saves rows with the secret key's role (service_role). With
-- "Automatically expose new tables" off, that role has no insert permission until
-- it's granted here. Safe to run at any time: it doesn't change what the website
-- itself can do.

grant insert (donation_id, module, answers, app_version) on public.donations to service_role;
