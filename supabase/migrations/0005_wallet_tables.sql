create table if not exists public.wallet_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 24),
  created_at timestamptz not null default now(),
  constraint wallet_categories_user_name_key unique (user_id, name)
);

create unique index if not exists wallet_categories_user_lower_name_key
  on public.wallet_categories (user_id, lower(name));

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('expense', 'income')),
  entry_date date not null,
  category text not null check (length(btrim(category)) between 1 and 24),
  details text not null default '',
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wallet_entries_user_date_idx
  on public.wallet_entries (user_id, entry_date desc);

alter table public.wallet_categories enable row level security;
alter table public.wallet_entries enable row level security;

drop policy if exists "Users manage their own wallet categories" on public.wallet_categories;
create policy "Users manage their own wallet categories"
  on public.wallet_categories for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own wallet entries" on public.wallet_entries;
create policy "Users manage their own wallet entries"
  on public.wallet_entries for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.wallet_categories, public.wallet_entries from anon;
grant select, insert, update, delete on public.wallet_categories, public.wallet_entries to authenticated;
