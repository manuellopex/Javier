import { createAdminClient } from '@/lib/supabase/admin';
import type { RiskLevel } from '@/types';

interface AuditEntry {
  userId: string | null;
  event: string;
  detail?: Record<string, unknown>;
  risk?: RiskLevel;
  ip?: string | null;
}

/**
 * Writes an audit log entry. Uses the service-role client so logs are
 * append-only from the server (users can read but never write their logs).
 * Never throws — a logging failure must not break the action itself.
 */
export async function audit({ userId, event, detail = {}, risk = 'LOW', ip = null }: AuditEntry) {
  try {
    const admin = createAdminClient();
    await admin.from('security_logs').insert({
      user_id: userId,
      event,
      detail,
      risk,
      ip,
    });
  } catch (err) {
    console.error('[audit] failed to write security log:', err);
  }
}
