-- ===========================================================================
-- AURA Command Center — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor (or psql) once, before first use.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  source text not null default 'web' check (source in ('web', 'shortcut')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_idx
  on public.tasks (user_id, status, due_at nulls last);

-- ---------------------------------------------------------------------------
-- Memories (user-controlled assistant memory)
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'general',
  source text not null default 'assistant' check (source in ('user', 'assistant')),
  created_at timestamptz not null default now()
);

create index if not exists memories_user_idx
  on public.memories (user_id, created_at desc);

-- Full-text search over memories
create index if not exists memories_content_fts
  on public.memories using gin (to_tsvector('simple', content));

-- ---------------------------------------------------------------------------
-- Commands (actions that may require confirmation)
-- ---------------------------------------------------------------------------
create table if not exists public.commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  action text not null,
  description text not null,
  payload jsonb not null default '{}',
  risk text not null check (risk in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'executed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists commands_user_idx
  on public.commands (user_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Security / audit logs
-- ---------------------------------------------------------------------------
create table if not exists public.security_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  detail jsonb not null default '{}',
  risk text not null default 'LOW' check (risk in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists security_logs_user_idx
  on public.security_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is private to its owner.
-- The service-role key (server only) bypasses RLS for the Shortcuts endpoint
-- and audit logging.
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.memories enable row level security;
alter table public.commands enable row level security;
alter table public.integrations enable row level security;
alter table public.security_logs enable row level security;

create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own commands" on public.commands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own integrations" on public.integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Security logs: the owner can read their logs; only the server writes them.
create policy "read own security logs" on public.security_logs
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Fase 3 additions (events, clients, quotes) — same content as
-- db/migrations/002_phase3.sql, kept here so fresh installs run one file.
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
