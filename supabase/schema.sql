-- Expense tracker schema. Run this once in the Supabase SQL editor
-- (or via `supabase db push`) on a fresh project.
-- Single-user app: every table is scoped by auth.uid() via RLS.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user. Holds the app-lock PIN hash.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text,               -- salted hash of the PIN; null = lock not set up
  pin_salt text,
  biometric_enabled boolean not null default false,
  currency text not null default 'LKR',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts: cash, bank cards, savings accounts, etc.
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash', 'card', 'bank', 'other')),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories: fully user-owned (per your "let me customize them" answer).
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'tag',      -- lucide-react icon name
  color_bg text not null default '#F2F2FA',
  color_fg text not null default '#5A5A78',
  color_dot text not null default '#8A8AA3',
  is_income boolean not null default false,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions: the ledger. source distinguishes manual vs scanned vs recurring.
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  is_income boolean not null default false,
  txn_date date not null default current_date,
  merchant text,
  note text,
  source text not null default 'manual' check (source in ('manual', 'bill', 'recurring', 'transfer')),
  confidence numeric(3, 2),              -- 0.00-1.00, set when source = 'bill'
  receipt_path text,                     -- path in the 'receipts' storage bucket
  recurring_template_id uuid,            -- set when source = 'recurring'
  to_account_id uuid references accounts(id) on delete set null, -- set when source = 'transfer'
  raw_extraction jsonb,                  -- full model output, kept for audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on transactions (user_id, txn_date desc);

-- ---------------------------------------------------------------------------
-- budgets: one row per category per month ("2026-09-01" style month_start).
-- ---------------------------------------------------------------------------
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month_start date not null,             -- always the 1st of the month
  limit_amount numeric(12, 2) not null check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month_start)
);

-- ---------------------------------------------------------------------------
-- recurring_templates: things you *might* add each month (bills, rent...).
-- ---------------------------------------------------------------------------
create table if not exists recurring_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  default_amount numeric(12, 2) not null,
  day_of_month int not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recurring_confirmations: tracks which templates you have already actioned
-- (added or skipped) for a given month, so the "due" checklist does not
-- nag you twice.
-- ---------------------------------------------------------------------------
create table if not exists recurring_confirmations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_template_id uuid not null references recurring_templates(id) on delete cascade,
  month_start date not null,
  status text not null check (status in ('added', 'skipped')),
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recurring_template_id, month_start)
);

-- ---------------------------------------------------------------------------
-- Row Level Security -- every table only ever shows/accepts the owner's rows.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table recurring_templates enable row level security;
alter table recurring_confirmations enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own accounts" on accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurring_templates" on recurring_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurring_confirmations" on recurring_confirmations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed: default categories + a cash account, created for a new user via
-- the handle_new_user trigger below so the app is not empty on first login.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id) values (new.id);

  insert into accounts (user_id, name, kind, sort_order) values
    (new.id, 'Cash', 'cash', 0);

  insert into categories (user_id, name, icon, color_bg, color_fg, color_dot, is_income, sort_order) values
    (new.id, 'Groceries', 'shopping-cart', '#EFE8FE', '#6D28D9', '#A78BFA', false, 0),
    (new.id, 'Transport',  'car',           '#FEF1DE', '#9A5B08', '#FCC26D', false, 1),
    (new.id, 'Eating out', 'utensils',      '#DFF9F4', '#0B6E60', '#5EEAD4', false, 2),
    (new.id, 'Bills',      'file-text',     '#FEF6DC', '#92610A', '#FCD34D', false, 3),
    (new.id, 'Health',     'heart-pulse',   '#E0EDFE', '#1D4ED8', '#60A5FA', false, 4),
    (new.id, 'Other',      'more-horizontal','#FEE7EF','#B3123A', '#FB7BA2', false, 5),
    (new.id, 'Salary',      'wallet',       '#D9F7E6', '#12854A', '#34D399', true, 0),
    (new.id, 'Other income','plus-circle',  '#ECFCCB', '#4D7C0F', '#A3E635', true, 1);

  return new;
end;
$$;

revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage bucket for receipt photos. Private; accessed via signed URLs only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "own receipts read" on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own receipts write" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own receipts delete" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
