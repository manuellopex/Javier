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

-- ===========================================================================
-- Agent-system additions (leads, projects, contents, content_metrics) — same
-- content as db/migrations/003_agents.sql for fresh installs.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Leads (Sales Desk / TTP Growth)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,                -- email / phone / IG handle / discord
  source text not null default 'other'
    check (source in ('instagram', 'youtube', 'webinar', 'ttp', 'referral', 'website', 'other')),
  segment text,                -- e.g. webinar_attended, webinar_no_show, hot, member, inactive
  interest text,               -- what they want
  value_estimate numeric(12, 2),
  currency text not null default 'USD',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_idx
  on public.leads (user_id, status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Projects (Production Hub)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  kind text not null default 'other'
    check (kind in ('reel', 'video', 'campaign', 'webinar', 'automation', 'other')),
  status text not null default 'planning'
    check (status in ('planning', 'production', 'post', 'review', 'delivered', 'archived')),
  due_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_idx
  on public.projects (user_id, status, due_at nulls last);

-- Tasks can belong to a project
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists tasks_project_idx on public.tasks (project_id);

-- ---------------------------------------------------------------------------
-- Contents (Content Lab: ideas, scripts, captions, calendars, reports,
-- references from YouTube/Spotify, TTP emails/posts/SOPs…)
-- ---------------------------------------------------------------------------
create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  type text not null
    check (type in ('idea', 'hook', 'script', 'caption', 'thumbnail', 'calendar',
                    'report', 'reference', 'playlist', 'email', 'post', 'sop', 'brief')),
  title text not null,
  body text not null default '',
  platform text,               -- instagram / youtube / spotify / discord / email / ttp…
  source_url text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contents_user_idx
  on public.contents (user_id, type, created_at desc);

-- ---------------------------------------------------------------------------
-- Content metrics (manual today; Instagram API later feeds the same table)
-- ---------------------------------------------------------------------------
create table if not exists public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.contents(id) on delete set null,
  platform text not null default 'instagram',
  ref text,                    -- URL or identifier of the post
  views bigint,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  follows integer,
  watch_seconds integer,       -- avg watch time
  posted_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists content_metrics_user_idx
  on public.content_metrics (user_id, platform, posted_at desc nulls last);

-- ---------------------------------------------------------------------------
-- Conversations remember which agent ran them
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists agent_id text;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.projects enable row level security;
alter table public.contents enable row level security;
alter table public.content_metrics enable row level security;

create policy "own leads" on public.leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own contents" on public.contents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own content_metrics" on public.content_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists contents_updated_at on public.contents;
create trigger contents_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();
