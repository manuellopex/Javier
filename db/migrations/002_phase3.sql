-- ===========================================================================
-- Fase 3: calendar events, clients, quotes
-- Run in the Supabase SQL editor if you already created the Phase 1 schema.
-- (Fresh installs: db/schema.sql already includes all of this.)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Events (local calendar; Google Calendar merges in when connected)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_user_time_idx
  on public.events (user_id, starts_at);

-- ---------------------------------------------------------------------------
-- Clients (lightweight CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  status text not null default 'lead' check (status in ('lead', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_idx
  on public.clients (user_id, status, name);

-- ---------------------------------------------------------------------------
-- Quotes (assistant-generated, markdown body)
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  content text not null,
  amount numeric(12, 2),
  currency text not null default 'USD',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_user_idx
  on public.quotes (user_id, status, created_at desc);
create index if not exists quotes_client_idx
  on public.quotes (client_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;

create policy "own events" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own quotes" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();
