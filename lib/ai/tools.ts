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
