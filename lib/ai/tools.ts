import type { LLMToolDefinition } from './provider';

/**
 * Tool registry. Every tool is defined once here; each agent in
 * lib/agents/registry.ts gets a focused subset via toolsFor(). Execution and
 * risk gating happen in services/assistant.ts + lib/security/risk.ts.
 */
const T = (def: LLMToolDefinition) => def;

export const TOOL_DEFINITIONS: Record<string, LLMToolDefinition> = {
  // === Tasks ================================================================
  create_task: T({
    name: 'create_task',
    description:
      'Create a task or reminder. Call when the user asks to be reminded, adds a to-do, or when planning work that needs follow-up. Parse natural dates into ISO 8601 in due_at. Link to a project with project_id when working inside one.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative task title' },
        notes: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due_at: { type: 'string', description: 'ISO 8601 datetime' },
        project_id: { type: 'string', description: 'UUID of the project this task belongs to' },
      },
      required: ['title'],
    },
  }),
  list_tasks: T({
    name: 'list_tasks',
    description:
      "List the user's tasks. Call when asked about pending work, organizing the day, or before completing/deleting a task. Filter by project_id when working inside a project.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'completed', 'all'] },
        project_id: { type: 'string' },
      },
    },
  }),
  complete_task: T({
    name: 'complete_task',
    description: 'Mark a task as completed. Use list_tasks first if you need the id.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  }),
  delete_task: T({
    name: 'delete_task',
    description:
      'Request deletion of a task. HIGH-risk: NOT executed directly — creates a pending approval the user must confirm in the UI.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  }),

  // === Memory ===============================================================
  save_memory: T({
    name: 'save_memory',
    description:
      'Save a durable fact, preference or context about the user/business for future conversations. Keep each memory short and self-contained. Never store secrets.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'One-sentence fact' },
        category: {
          type: 'string',
          description: 'personal, work, clients, preferences, ideas, content, ttp, general',
        },
      },
      required: ['content'],
    },
  }),
  search_memory: T({
    name: 'search_memory',
    description:
      "Search saved memories/notes. Call when the user references past context you don't have.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  }),
  list_memories: T({
    name: 'list_memories',
    description: 'List recent saved memories.',
    input_schema: { type: 'object', properties: {} },
  }),
  delete_memory: T({
    name: 'delete_memory',
    description:
      'Request deletion of a memory. HIGH-risk: creates a pending approval requiring manual confirmation.',
    input_schema: {
      type: 'object',
      properties: { memory_id: { type: 'string' } },
      required: ['memory_id'],
    },
  }),

  // === Calendar =============================================================
  list_events: T({
    name: 'list_events',
    description:
      "List calendar events (local + Google when connected). Call when asked about schedule, agenda or availability.",
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO 8601 range start (default now)' },
        to: { type: 'string', description: 'ISO 8601 range end (default +14 days)' },
      },
    },
  }),
  create_event: T({
    name: 'create_event',
    description:
      'Create a calendar event (Google when connected, else local). Default duration 60 minutes.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        starts_at: { type: 'string', description: 'ISO 8601' },
        ends_at: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
        all_day: { type: 'boolean' },
      },
      required: ['title', 'starts_at'],
    },
  }),
  delete_event: T({
    name: 'delete_event',
    description:
      'Request deletion of a calendar event. HIGH-risk: creates a pending approval. Get id/source from list_events first.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        source: { type: 'string', enum: ['local', 'google'] },
        title: { type: 'string' },
      },
      required: ['event_id', 'source'],
    },
  }),

  // === Email ================================================================
  send_email: T({
    name: 'send_email',
    description:
      'Request sending an email. HIGH-risk: NEVER sent directly — creates a pending approval the user confirms in the UI. Always show the full draft (to, subject, body) in your reply. Plain text body.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  }),

  // === CRM (clients & quotes) ==============================================
  list_clients: T({
    name: 'list_clients',
    description: "List the user's clients. Call before creating quotes or projects for a client.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['lead', 'active', 'archived', 'all'] },
        query: { type: 'string' },
      },
    },
  }),
  create_client: T({
    name: 'create_client',
    description: 'Add a client to the CRM.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        company: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string', enum: ['lead', 'active'] },
      },
      required: ['name'],
    },
  }),
  create_quote: T({
    name: 'create_quote',
    description:
      'Create a quote for an existing client (get client_id via list_clients/create_client). Write the complete quote in markdown: scope, deliverables, timeline, price breakdown, terms. Saved as draft.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string', description: 'Full quote in markdown' },
        amount: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['client_id', 'title', 'content'],
    },
  }),
  list_quotes: T({
    name: 'list_quotes',
    description: 'List quotes, optionally for one client.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'all'] },
      },
    },
  }),

  // === Leads (Sales Desk / TTP) =============================================
  create_lead: T({
    name: 'create_lead',
    description:
      'Add a lead to the pipeline. Call when the user mentions a prospect, webinar registrant, DM inquiry or potential TTP member.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        contact: { type: 'string', description: 'email / phone / IG handle / discord' },
        source: {
          type: 'string',
          enum: ['instagram', 'youtube', 'webinar', 'ttp', 'referral', 'website', 'other'],
        },
        segment: {
          type: 'string',
          description: 'e.g. webinar_attended, webinar_no_show, hot, member, inactive',
        },
        interest: { type: 'string' },
        value_estimate: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  }),
  list_leads: T({
    name: 'list_leads',
    description:
      'List leads. Use to find follow-up opportunities (check last_contact_at), segment audiences, or before updating a lead. Filter by status/source/segment.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'all'],
        },
        source: { type: 'string' },
        segment: { type: 'string' },
      },
    },
  }),
  update_lead: T({
    name: 'update_lead',
    description:
      'Update a lead: status, segment, notes, value, or mark contact (set touched=true to stamp last_contact_at). Get the id via list_leads.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
        },
        segment: { type: 'string' },
        interest: { type: 'string' },
        value_estimate: { type: 'number' },
        notes: { type: 'string' },
        touched: { type: 'boolean', description: 'true = stamp last_contact_at to now' },
      },
      required: ['lead_id'],
    },
  }),

  // === Projects (Production Hub) ============================================
  create_project: T({
    name: 'create_project',
    description:
      'Create a production project (reel, video, campaign, webinar, automation). Link a client with client_id when known. After creating, add phase tasks with create_task + project_id.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['reel', 'video', 'campaign', 'webinar', 'automation', 'other'],
        },
        client_id: { type: 'string' },
        due_at: { type: 'string', description: 'ISO 8601 deadline' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  }),
  list_projects: T({
    name: 'list_projects',
    description: 'List production projects with status and deadlines.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['planning', 'production', 'post', 'review', 'delivered', 'archived', 'all'],
        },
      },
    },
  }),
  update_project: T({
    name: 'update_project',
    description: 'Update a project status, deadline or notes. Get id via list_projects.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['planning', 'production', 'post', 'review', 'delivered', 'archived'],
        },
        due_at: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['project_id'],
    },
  }),

  // === Contents (Content Lab) ===============================================
  save_content: T({
    name: 'save_content',
    description:
      'Save a content artifact you produced: ideas, hooks, scripts, captions, thumbnail text, content calendars, analysis reports, references (YouTube/Spotify), playlists, emails, Discord posts, SOPs. The user reviews them in the matching workspace. Use markdown in body.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'idea', 'hook', 'script', 'caption', 'thumbnail', 'calendar',
            'report', 'reference', 'playlist', 'email', 'post', 'sop',
          ],
        },
        title: { type: 'string' },
        body: { type: 'string', description: 'Full content in markdown' },
        platform: {
          type: 'string',
          description: 'instagram / youtube / spotify / discord / email / ttp',
        },
        source_url: { type: 'string', description: 'For references: the original URL' },
        project_id: { type: 'string' },
      },
      required: ['type', 'title', 'body'],
    },
  }),
  list_contents: T({
    name: 'list_contents',
    description:
      'List saved content artifacts. Use to review past scripts/captions/references, compare ideas, or build on previous work. Filter by type/platform.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        platform: { type: 'string' },
        query: { type: 'string', description: 'Title substring filter' },
      },
    },
  }),

  // === Content metrics ======================================================
  log_content_metrics: T({
    name: 'log_content_metrics',
    description:
      'Record performance metrics for a published piece (manual entry until the Instagram API is connected). Call when the user reports numbers ("el reel de ayer hizo 80k views").',
    input_schema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: 'instagram / youtube / tiktok' },
        ref: { type: 'string', description: 'Post URL or identifier' },
        content_id: { type: 'string', description: 'Link to a saved content item if known' },
        views: { type: 'number' },
        likes: { type: 'number' },
        comments: { type: 'number' },
        shares: { type: 'number' },
        saves: { type: 'number' },
        follows: { type: 'number' },
        watch_seconds: { type: 'number', description: 'Average watch time in seconds' },
        posted_at: { type: 'string', description: 'ISO 8601 publish date' },
        notes: { type: 'string', description: 'Hook used, format, topic, anything contextual' },
      },
      required: ['platform'],
    },
  }),
  list_content_metrics: T({
    name: 'list_content_metrics',
    description:
      'List recorded content metrics. Use to compare performance, detect winning patterns (hooks, formats, topics) and ground recommendations in real numbers.',
    input_schema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        limit: { type: 'number', description: 'Default 30' },
      },
    },
  }),

  // === External research ====================================================
  youtube_search: T({
    name: 'youtube_search',
    description:
      'Search YouTube videos by topic (YouTube Data API) with public stats: views, likes, comments, duration. Use for research: analyze titles/formats that perform, find opportunities. NEVER copy content — identify patterns and create original ideas.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'number', description: '1-25, default 10' },
        order: { type: 'string', enum: ['relevance', 'viewCount', 'date'] },
      },
      required: ['query'],
    },
  }),
  spotify_search: T({
    name: 'spotify_search',
    description:
      'Search tracks on Spotify (name, artists, album, popularity, preview link). Classify mood/energy/production type using your own musical knowledge. ALWAYS warn that Spotify tracks are NOT licensed for commercial video use — recommend licensed libraries (Artlist, Epidemic Sound) for final production.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Track, artist, vibe or genre keywords' },
        limit: { type: 'number', description: '1-25, default 10' },
      },
      required: ['query'],
    },
  }),

  // === System ===============================================================
  list_pending_approvals: T({
    name: 'list_pending_approvals',
    description:
      'List actions waiting for the user\'s manual approval. Use in daily planning to surface blockers.',
    input_schema: { type: 'object', properties: {} },
  }),
};

/** Resolve a list of tool names into definitions (unknown names are skipped). */
export function toolsFor(names: string[]): LLMToolDefinition[] {
  return names.map((n) => TOOL_DEFINITIONS[n]).filter(Boolean);
}

/** Full tool set — used by the general AURA agent and the Shortcuts endpoint. */
export const ASSISTANT_TOOLS: LLMToolDefinition[] = Object.values(TOOL_DEFINITIONS);
