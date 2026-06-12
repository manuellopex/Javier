import type { LLMToolDefinition } from './provider';

/**
 * Tool surface exposed to the model. Execution is handled in
 * services/assistant.ts, where every call passes through the risk /
 * confirmation policy in lib/security/risk.ts.
 */
export const ASSISTANT_TOOLS: LLMToolDefinition[] = [
  {
    name: 'create_task',
    description:
      'Create a task or reminder for the user. Call this when the user asks to be reminded of something, to add a to-do, or to schedule follow-up work. Parse natural dates ("mañana", "next Friday") into ISO 8601 in due_at when possible.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative task title' },
        notes: { type: 'string', description: 'Optional extra context' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due_at: {
          type: 'string',
          description: 'ISO 8601 datetime when the task is due, if the user gave one',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description:
      'List the user\'s tasks. Call this when the user asks what they have pending, wants to organize their day, or references "my tasks".',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'completed', 'all'] },
      },
    },
  },
  {
    name: 'complete_task',
    description:
      'Mark a task as completed. Use list_tasks first if you need the task id. Only call when the user clearly states the task is done.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'UUID of the task' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'delete_task',
    description:
      'Request deletion of a task. This is a HIGH-risk action: it does NOT delete immediately — it creates a pending command the user must confirm in the UI. Tell the user confirmation is required.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'UUID of the task' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'save_memory',
    description:
      'Save a durable fact, preference, or piece of context about the user for future conversations. Call this when the user shares something worth remembering ("recuerda que...", client names, preferences, recurring context). Keep each memory short and self-contained.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact to remember, one sentence' },
        category: {
          type: 'string',
          description: 'One of: personal, work, clients, preferences, ideas, general',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'search_memory',
    description:
      'Search the user\'s saved memories and notes. Call this when the user asks "busca en mis notas", references past context you do not have, or when an answer likely depends on stored facts.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms' },
      },
      required: ['query'],
    },
  },
  // --- Calendar ---------------------------------------------------------------
  {
    name: 'list_events',
    description:
      "List the user's calendar events (local + Google Calendar when connected). Call this when the user asks about their schedule, agenda, availability, or wants to organize their day around meetings.",
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO 8601 range start (default: now)' },
        to: { type: 'string', description: 'ISO 8601 range end (default: 14 days from now)' },
      },
    },
  },
  {
    name: 'create_event',
    description:
      'Create a calendar event. Goes to Google Calendar when connected, otherwise to the local AURA calendar. Parse natural dates into ISO 8601. Default duration 60 minutes when the user gives only a start time.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        starts_at: { type: 'string', description: 'ISO 8601 start datetime' },
        ends_at: { type: 'string', description: 'ISO 8601 end datetime (default: start + 60min)' },
        description: { type: 'string' },
        location: { type: 'string' },
        all_day: { type: 'boolean' },
      },
      required: ['title', 'starts_at'],
    },
  },
  {
    name: 'delete_event',
    description:
      'Request deletion of a calendar event. HIGH-risk: creates a pending command requiring manual confirmation in the UI. Get id and source from list_events first. Tell the user confirmation is required.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        source: { type: 'string', enum: ['local', 'google'] },
        title: { type: 'string', description: 'Event title, for the confirmation message' },
      },
      required: ['event_id', 'source'],
    },
  },
  // --- Email --------------------------------------------------------------------
  {
    name: 'send_email',
    description:
      'Request sending an email. HIGH-risk: it is NEVER sent directly — a pending command is created and the user must confirm it in the UI. Always show the user the full draft (to, subject, body) in your reply BEFORE or WHILE calling this. Plain text body, no markdown.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain-text email body' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  // --- CRM ------------------------------------------------------------------------
  {
    name: 'list_clients',
    description:
      "List the user's clients (lightweight CRM). Call before creating quotes or when the user references a client by name and you need the id.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['lead', 'active', 'archived', 'all'] },
        query: { type: 'string', description: 'Filter by name/company substring' },
      },
    },
  },
  {
    name: 'create_client',
    description:
      'Add a client to the CRM. Call when the user mentions a new client, lead, or contact worth tracking.',
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
  },
  {
    name: 'create_quote',
    description:
      'Create a quote/cotización for an existing client (use list_clients or create_client first to get client_id). Write the full quote body in markdown: scope, deliverables, terms, price breakdown. It is saved as a draft the user can review in the Clients view.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string', description: 'Full quote body in markdown' },
        amount: { type: 'number', description: 'Total amount' },
        currency: { type: 'string', description: 'ISO currency code, default USD' },
      },
      required: ['client_id', 'title', 'content'],
    },
  },
  {
    name: 'list_quotes',
    description: 'List quotes, optionally for a single client.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'all'] },
      },
    },
  },
  {
    name: 'delete_memory',
    description:
      'Request deletion of a saved memory. HIGH-risk: creates a pending command requiring manual confirmation in the UI. Tell the user confirmation is required.',
    input_schema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'UUID of the memory' },
      },
      required: ['memory_id'],
    },
  },
];
