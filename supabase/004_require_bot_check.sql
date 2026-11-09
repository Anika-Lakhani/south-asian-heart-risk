-- Run once in Supabase's SQL Editor, ONLY after the "donate" Edge Function is
-- deployed and the site is using it (see docs/DONATIONS.md).
--
-- Removes the website's ability to insert directly, so every donation has to pass
-- the bot check in the "donate" function. That function saves rows with the
-- secret key's role, which gets insert access here.

drop policy if exists "Anyone can add a donation" on public.donations;
revoke insert on public.donations from anon;

grant insert (donation_id, module, answers, app_version) on public.donations to service_role;
