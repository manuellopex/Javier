import type { SupabaseClient } from '@supabase/supabase-js';
import { getLLM, type LLMContentBlock, type LLMMessage, type LLMToolDefinition } from '@/lib/ai';
import { ASSISTANT_TOOLS } from '@/lib/ai/tools';
import { AURA_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { requiresConfirmation, riskOf } from '@/lib/security/risk';
import { audit } from '@/lib/security/audit';
import { runTool } from '@/services/tool-handlers';
import { isValidEmail } from '@/services/email';
import type { ChatStreamEvent, Command, ToolCallRecord } from '@/types';

const MAX_TOOL_ROUNDS = 8;

interface ToolExecution {
  /** Result text fed back to the model. */
  result: string;
  isError?: boolean;
  /** Set when the tool created a pending approval. */
  pendingCommand?: Pick<Command, 'id' | 'action' | 'description' | 'risk'>;
}

/**
 * Executes a single tool call on behalf of `userId`, enforcing the risk
 * policy: HIGH/CRITICAL actions are converted into pending approvals instead
 * of being executed. Every call is audit-logged with the agent that made it.
 */
export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | null,
  name: string,
  input: Record<string, unknown>,
  agentId = 'aura'
): Promise<ToolExecution> {
  const risk = riskOf(name);

  // Fail fast on obviously invalid payloads before queuing a confirmation.
  if (name === 'send_email' && !isValidEmail(String(input.to ?? ''))) {
    return { result: `"${input.to}" is not a valid email address.`, isError: true };
  }

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
      return { result: `Failed to queue approval: ${error?.message ?? 'unknown'}`, isError: true };
    }

    await audit({
      userId,
      event: 'command.queued',
      detail: { action: name, input, command_id: command.id, agent: agentId },
      risk,
    });

    return {
      result: `This is a ${risk}-risk action. It was NOT executed. A pending approval (id ${command.id}) was created and the user must confirm it in the AURA interface (Approvals view).`,
      pendingCommand: command as ToolExecution['pendingCommand'],
    };
  }

  try {
    const result = await runTool(supabase, userId, name, input);
    await audit({
      userId,
      event: 'tool.executed',
      detail: { action: name, input, agent: agentId },
      risk,
    });
    return { result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await audit({
      userId,
      event: 'tool.error',
      detail: { action: name, input, error: message, agent: agentId },
      risk,
    });
    return { result: `Tool error: ${message}`, isError: true };
  }
}

function describeCommand(action: string, input: Record<string, unknown>): string {
  switch (action) {
    case 'delete_task':
      return `Delete task ${input.task_id}`;
    case 'delete_memory':
      return `Delete memory ${input.memory_id}`;
    case 'delete_event':
      return `Delete calendar event "${input.title ?? input.event_id}" (${input.source})`;
    case 'send_email':
      return `Send email to ${input.to} — "${String(input.subject ?? '').slice(0, 120)}"`;
    case 'run_desktop_command': {
      const params = JSON.stringify(input.params ?? {}).slice(0, 160);
      return `Desktop: ${input.action} ${params}${input.reason ? ` — ${String(input.reason).slice(0, 100)}` : ''}`;
    }
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
  /** Agent overrides — default: general AURA agent with the full tool set. */
  agentId?: string;
  system?: string;
  tools?: LLMToolDefinition[];
}): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const {
    supabase,
    userId,
    conversationId,
    history,
    memoriesContext,
    emit,
    agentId = 'aura',
    system = AURA_SYSTEM_PROMPT,
    tools = ASSISTANT_TOOLS,
  } = params;
  const llm = getLLM();

  // Dynamic context goes AFTER the cached system block, as the first user-turn
  // prefix, to keep the system prompt byte-stable for prompt caching.
  const messages: LLMMessage[] = [...history];
  if (messages.length > 0) {
    const first = messages[0];
    const note = `<context>\nCurrent date: ${new Date().toISOString()}\n${
      memoriesContext ? `Relevant saved memories:\n${memoriesContext}\n` : ''
    }</context>\n\n`;
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
      tools,
      callbacks: { onTextDelta: (text) => emit({ type: 'delta', text }) },
    });

    finalText += turn.text;

    if (turn.stopReason !== 'tool_use' || turn.toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: turn.assistantContent });

    const results: LLMContentBlock[] = [];
    for (const use of turn.toolUses) {
      const execution = await executeTool(
        supabase,
        userId,
        conversationId,
        use.name,
        use.input,
        agentId
      );

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
