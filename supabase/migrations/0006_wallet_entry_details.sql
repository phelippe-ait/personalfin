alter table public.wallet_entries
  add column if not exists details text not null default '';
