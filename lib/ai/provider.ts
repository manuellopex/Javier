/**
 * Provider-agnostic LLM abstraction.
 *
 * AURA talks to this interface, never to a vendor SDK directly. The active
 * provider is selected in lib/ai/index.ts via the LLM_PROVIDER env var.
 * Today only "anthropic" is implemented; adding another provider means
 * implementing LLMProvider in a new file — nothing else changes.
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMStreamCallbacks {
  /** Called for every text token of the assistant's visible reply. */
  onTextDelta: (text: string) => void;
}

export interface LLMTurnResult {
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'other';
  text: string;
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
  /** Raw assistant content blocks to echo back into the conversation. */
  assistantContent: LLMContentBlock[];
}

export interface LLMProvider {
  readonly name: string;
  /**
   * Runs a single model turn with streaming. The caller owns the agentic
   * loop (so the permission system can gate every tool execution).
   */
  streamTurn(params: {
    system: string;
    messages: LLMMessage[];
    tools: LLMToolDefinition[];
    maxTokens?: number;
    callbacks: LLMStreamCallbacks;
  }): Promise<LLMTurnResult>;

  /** Single non-streaming completion without tools (Shortcuts endpoint). */
  complete(params: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}
