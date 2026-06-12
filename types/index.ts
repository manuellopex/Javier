// ---------------------------------------------------------------------------
// Shared domain types for AURA Command Center
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AssistantStatus = 'online' | 'listening' | 'thinking' | 'action_required';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  source: 'web' | 'shortcut';
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  /** Tool calls executed while producing this message (for transparency). */
  tool_calls: ToolCallRecord[] | null;
  created_at: string;
}

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  risk: RiskLevel;
  status: 'executed' | 'pending_confirmation' | 'denied' | 'error';
}

export type TaskStatus = 'pending' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryEntry {
  id: string;
  user_id: string;
  content: string;
  category: string;
  source: 'user' | 'assistant';
  created_at: string;
}

export type CommandStatus = 'pending' | 'approved' | 'denied' | 'executed' | 'failed' | 'expired';

export interface Command {
  id: string;
  user_id: string;
  conversation_id: string | null;
  action: string;
  description: string;
  payload: Record<string, unknown>;
  risk: RiskLevel;
  status: CommandStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Integration {
  id: string;
  user_id: string;
  kind: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface SecurityLog {
  id: string;
  user_id: string | null;
  event: string;
  detail: Record<string, unknown>;
  risk: RiskLevel;
  ip: string | null;
  created_at: string;
}

// --- Chat streaming protocol (SSE events from /api/chat) --------------------

export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; status: ToolCallRecord['status']; risk: RiskLevel }
  | { type: 'command_pending'; command: Pick<Command, 'id' | 'action' | 'description' | 'risk'> }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };
