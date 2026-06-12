import type { SupabaseClient } from '@supabase/supabase-js';
import { getLLM, type LLMContentBlock, type LLMMessage } from '@/lib/ai';
import { ASSISTANT_TOOLS } from '@/lib/ai/tools';
import { AURA_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { requiresConfirmation, riskOf } from '@/lib/security/risk';
import { audit } from '@/lib/security/audit';
import type { ChatStreamEvent, Command, ToolCallRecord } from '@/types';

const MAX_TOOL_ROUNDS = 6;

interface ToolExecution {
  /** Result text fed back to the model. */
  result: string;
  isError?: boolean;
  /** Set when the tool created a pending command requiring confirmation. */
  pendingCommand?: Pick<Command, 'id' | 'action' | 'description' | 'risk'>;
}

/**
 * Executes a single tool call on behalf of `userId`, enforcing the risk
 * policy: HIGH/CRITICAL actions are converted into pending commands instead
 * of being executed. Every call is audit-logged.
 */
export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<ToolExecution> {
  const risk = riskOf(name);

  if (requiresConfirmation(name)) {
    const description = describeCommand(name, input);
    const { data: command, error } = await supabase
      .from('commands')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        action: name,
        description,
        payload: input,
        risk,
        status: 'pending',
      })
      .select('id, action, description, risk')
      .single();

    if (error || !command) {
      return { result: `Failed to queue command: ${error?.message ?? 'unknown'}`, isError: true };
    }

    await audit({
      userId,
      event: 'command.queued',
      detail: { action: name, input, command_id: command.id },
      risk,
    });

    return {
      result: `This is a ${risk}-risk action. It was NOT executed. A pending command (id ${command.id}) was created and the user must confirm it in the AURA interface (Commands view).`,
      pendingCommand: command as ToolExecution['pendingCommand'],
    };
  }

  try {
    const result = await runTool(supabase, userId, name, input);
    await audit({ userId, event: 'tool.executed', detail: { action: name, input }, risk });
    return { result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await audit({
      userId,
      event: 'tool.error',
      detail: { action: name, input, error: message },
      risk,
    });
    return { result: `Tool error: ${message}`, isError: true };
  }
}

async function runTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'create_task': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: String(input.title ?? '').slice(0, 500),
          notes: input.notes ? String(input.notes) : null,
          priority: ['low', 'medium', 'high'].includes(String(input.priority))
            ? String(input.priority)
            : 'medium',
          due_at: input.due_at ? new Date(String(input.due_at)).toISOString() : null,
        })
        .select('id, title, due_at, priority')
        .single();
      if (error) throw new Error(error.message);
      return `Task created: ${JSON.stringify(data)}`;
    }

    case 'list_tasks': {
      const status = String(input.status ?? 'pending');
      let query = supabase
        .from('tasks')
        .select('id, title, notes, status, priority, due_at')
        .eq('user_id', userId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(50);
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No tasks found.';
    }

    case 'complete_task': {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', String(input.task_id))
        .eq('user_id', userId)
        .select('id, title')
        .single();
      if (error) throw new Error(error.message);
      return `Task completed: ${data.title}`;
    }

    case 'save_memory': {
      const { data, error } = await supabase
        .from('memories')
        .insert({
          user_id: userId,
          content: String(input.content ?? '').slice(0, 2000),
          category: String(input.category ?? 'general'),
          source: 'assistant',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return `Memory saved (id ${data.id}).`;
    }

    case 'search_memory': {
      const query = String(input.query ?? '').trim();
      if (!query) return 'Empty query.';
      // Full-text search with ILIKE fallback for partial words.
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, category, created_at')
        .eq('user_id', userId)
        .or(
          `content.ilike.%${query.replaceAll('%', '').replaceAll(',', ' ')}%` // simple containment
        )
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No memories matched.';
    }

    case 'list_memories': {
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, category, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No memories stored.';
    }

    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

function describeCommand(action: string, input: Record<string, unknown>): string {
  switch (action) {
    case 'delete_task':
      return `Delete task ${input.task_id}`;
    case 'delete_memory':
      return `Delete memory ${input.memory_id}`;
    default:
      return `${action}: ${JSON.stringify(input).slice(0, 200)}`;
  }
}

/**
 * Runs the full agentic chat loop for one user message and streams events.
 *
 * The loop is manual (not the SDK tool runner) on purpose: every tool call
 * must pass through executeTool() so the permission system can intercept
 * HIGH/CRITICAL actions before they happen.
 */
export async function runAssistantTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  history: LLMMessage[];
  memoriesContext: string;
  emit: (event: ChatStreamEvent) => void;
}): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const { supabase, userId, conversationId, history, memoriesContext, emit } = params;
  const llm = getLLM();

  // Dynamic context goes AFTER the cached system block, as the first user-turn
  // prefix, to keep the system prompt byte-stable for prompt caching.
  const system = AURA_SYSTEM_PROMPT;
  const messages: LLMMessage[] = [...history];
  if (memoriesContext && messages.length > 0) {
    const first = messages[0];
    const note = `<context>\nCurrent date: ${new Date().toISOString()}\nRelevant saved memories:\n${memoriesContext}\n</context>\n\n`;
    if (typeof first.content === 'string') {
      messages[0] = { ...first, content: note + first.content };
    }
  }

  const toolCalls: ToolCallRecord[] = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await llm.streamTurn({
      system,
      messages,
      tools: ASSISTANT_TOOLS,
      callbacks: { onTextDelta: (text) => emit({ type: 'delta', text }) },
    });

    finalText += turn.text;

    if (turn.stopReason !== 'tool_use' || turn.toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: turn.assistantContent });

    const results: LLMContentBlock[] = [];
    for (const use of turn.toolUses) {
      const execution = await executeTool(supabase, userId, conversationId, use.name, use.input);

      const status: ToolCallRecord['status'] = execution.pendingCommand
        ? 'pending_confirmation'
        : execution.isError
          ? 'error'
          : 'executed';

      toolCalls.push({ name: use.name, input: use.input, risk: riskOf(use.name), status });
      emit({ type: 'tool', name: use.name, status, risk: riskOf(use.name) });
      if (execution.pendingCommand) {
        emit({ type: 'command_pending', command: execution.pendingCommand });
      }

      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: execution.result,
        is_error: execution.isError,
      });
    }

    messages.push({ role: 'user', content: results });
  }

  return { text: finalText, toolCalls };
}
