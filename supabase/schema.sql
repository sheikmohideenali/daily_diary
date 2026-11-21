-- Reference schema for the future cloud-sync implementation.
-- This SQL alone does not activate sync in the current frontend.
create extension if not exists pgcrypto;

create table if not exists public.daily_diaries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_date date not null,
  page_number integer not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, diary_date)
);

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_id uuid not null references public.daily_diaries(id) on delete cascade,
  particulars text not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_type text not null check (transaction_type in ('credit','debit')),
  category text not null default 'general',
  commission_member text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_diary_id_idx on public.transactions(diary_id);
create index if not exists transactions_user_created_idx on public.transactions(user_id, created_at desc);

alter table public.daily_diaries enable row level security;
alter table public.transactions enable row level security;

create policy "Users manage their own diaries" on public.daily_diaries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own transactions" on public.transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
