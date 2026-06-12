import type { RiskLevel } from '@/types';

/**
 * Risk classification per action type.
 *
 *  LOW      — answer, summarize, write, organize, read data.   → executes directly
 *  MEDIUM   — create task, create draft, save note/memory.     → executes directly,
 *             always audit-logged. (Confirmation kicks in when it mutates
 *             existing data in a non-reversible way.)
 *  HIGH     — send email, modify/delete records, change calendar,
 *             run desktop commands.                            → ALWAYS requires manual confirmation
 *  CRITICAL — payments, credentials, mass deletion, private data. → ALWAYS requires confirmation
 */
export const TOOL_RISK: Record<string, RiskLevel> = {
  list_tasks: 'LOW',
  search_memory: 'LOW',
  list_memories: 'LOW',
  list_events: 'LOW',
  list_clients: 'LOW',
  list_quotes: 'LOW',
  create_task: 'MEDIUM',
  complete_task: 'MEDIUM',
  save_memory: 'MEDIUM',
  create_event: 'MEDIUM',
  create_client: 'MEDIUM',
  update_client: 'MEDIUM',
  create_quote: 'MEDIUM',
  delete_task: 'HIGH',
  delete_memory: 'HIGH',
  delete_event: 'HIGH',
  send_email: 'HIGH',
  run_desktop_command: 'HIGH',
  make_payment: 'CRITICAL',
};

const RISK_ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function riskOf(tool: string): RiskLevel {
  return TOOL_RISK[tool] ?? 'HIGH'; // unknown actions are treated as HIGH
}

export function riskAtLeast(risk: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_ORDER.indexOf(risk) >= RISK_ORDER.indexOf(threshold);
}

/** HIGH and CRITICAL actions always require manual confirmation. */
export function requiresConfirmation(tool: string): boolean {
  return riskAtLeast(riskOf(tool), 'HIGH');
}
