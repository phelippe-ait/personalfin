# personalfin

## Supabase setup

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the local `.env.local` file and in the deployment environment.
- Run [`supabase/migrations/0005_wallet_tables.sql`](supabase/migrations/0005_wallet_tables.sql) in the Supabase SQL Editor. It creates the wallet tables and enables per-user Row Level Security.
- In Supabase Auth URL configuration, allow the app’s preview and deployed origins as redirect URLs. Email sign-in sends a magic link back to the current origin.

The first sign-in imports any existing `mono-entries` and `mono-categories` browser data into that user’s Supabase account. The wallet uses AUD and the Australia/Sydney calendar date.
