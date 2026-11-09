# Database setup

Everything the donation database needs, in the order to apply it.

| File | What it does |
|---|---|
| [`schema.sql`](schema.sql) | The `donations` table, its permissions, and the public `contributor_count()`. Already includes everything from 002–004. |
| [`002_count_excludes_tests.sql`](002_count_excludes_tests.sql) | *Upgrade only:* makes the count ignore test entries. |
| [`003_release_reader.sql`](003_release_reader.sql) | *Upgrade only:* lets the secret key read rows for releases. |
| [`004_function_can_insert.sql`](004_function_can_insert.sql) | *Upgrade only:* lets the `donate` function save rows. |
| [`005_require_bot_check.sql`](005_require_bot_check.sql) | Removes direct inserts, so every donation must pass the bot check. |
| [`functions/donate/index.ts`](functions/donate/index.ts) | The Edge Function that verifies the Cloudflare Turnstile check, then saves the row. |

## A new project

1. Create the project with **Automatically expose new tables** off and **automatic RLS** on.
2. Run `schema.sql` in the SQL Editor.
3. Deploy `functions/donate/index.ts` as an Edge Function named `donate`, turn off
   **Verify JWT**, and add the `TURNSTILE_SECRET_KEY` secret.
4. Make a test donation through the site (from `localhost`, so it's tagged `test-local`).
5. Run `005_require_bot_check.sql`.

## The project created on 2026-11-09

It was built incrementally: `schema.sql` (original version), then 002, 003, 004, and 005.
Its current state matches a new project set up as above.

See [docs/DONATIONS.md](../docs/DONATIONS.md) for how it all fits together.
