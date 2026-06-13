-- ===========================================================================
-- Fase agentes: leads, projects, contents, content_metrics
-- Run in the Supabase SQL editor if you already have the previous schema.
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
