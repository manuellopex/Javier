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
  // LOW — read, search, analyze
  list_tasks: 'LOW',
  search_memory: 'LOW',
  list_memories: 'LOW',
  list_events: 'LOW',
  list_clients: 'LOW',
  list_quotes: 'LOW',
  list_leads: 'LOW',
  list_projects: 'LOW',
  list_contents: 'LOW',
  list_content_metrics: 'LOW',
  list_pending_approvals: 'LOW',
  youtube_search: 'LOW',
  spotify_search: 'LOW',
  // MEDIUM — create drafts, tasks, records (direct + audit log)
  create_task: 'MEDIUM',
  complete_task: 'MEDIUM',
  save_memory: 'MEDIUM',
  create_event: 'MEDIUM',
  create_client: 'MEDIUM',
  update_client: 'MEDIUM',
  create_quote: 'MEDIUM',
  create_lead: 'MEDIUM',
  update_lead: 'MEDIUM',
  create_project: 'MEDIUM',
  update_project: 'MEDIUM',
  save_content: 'MEDIUM',
  log_content_metrics: 'MEDIUM',
  // HIGH — always require manual approval
  delete_task: 'HIGH',
  delete_memory: 'HIGH',
  delete_event: 'HIGH',
  send_email: 'HIGH',
  publish_content: 'HIGH',
  run_desktop_command: 'HIGH',
  // CRITICAL — always require manual approval
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
