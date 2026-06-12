import { createAdminClient, getOwnerUserId } from '@/lib/supabase/admin';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { authorizeAgent } from '@/lib/security/agent-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A claimed command is re-delivered if the agent didn't report within this window. */
const CLAIM_TTL_MS = 2 * 60 * 1000;

/**
 * Desktop agent poll. The agent calls this every few seconds (outbound only —
 * no inbound connection to the user's machine ever).
 *
 * Body (heartbeat): { hostname?, version?, actions?: string[] }
 * Returns approved desktop commands not yet claimed (or whose claim expired),
 * marking them claimed so a crash mid-execution re-delivers after CLAIM_TTL.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`desktop-poll:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!process.env.DESKTOP_AGENT_KEY) {
    return Response.json({ error: 'Desktop agent not configured (DESKTOP_AGENT_KEY)' }, { status: 503 });
  }
  if (!authorizeAgent(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    return Response.json({ error: 'Owner account not found (set ALLOWED_EMAIL)' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    hostname?: string;
    version?: string;
    actions?: string[];
  };
  const admin = createAdminClient();

  // --- Heartbeat: upsert the integration row so the UI shows connectivity ---
  const heartbeat = {
    last_seen: new Date().toISOString(),
    hostname: typeof body.hostname === 'string' ? body.hostname.slice(0, 100) : null,
    version: typeof body.version === 'string' ? body.version.slice(0, 20) : null,
    actions: Array.isArray(body.actions) ? body.actions.slice(0, 20) : [],
  };
  const { data: existing } = await admin
    .from('integrations')
    .select('id')
    .eq('user_id', ownerId)
    .eq('kind', 'desktop_agent')
    .maybeSingle();
  if (existing) {
    await admin.from('integrations').update({ enabled: true, config: heartbeat }).eq('id', existing.id);
  } else {
    await admin.from('integrations').insert({
      user_id: ownerId,
      kind: 'desktop_agent',
      name: 'Desktop Agent',
      enabled: true,
      config: heartbeat,
    });
  }

  // --- Deliver approved, unclaimed desktop commands -------------------------
  const { data: approved, error } = await admin
    .from('commands')
    .select('id, payload, created_at')
    .eq('user_id', ownerId)
    .eq('action', 'run_desktop_command')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const deliverable = (approved ?? []).filter((c) => {
    const claimedAt = (c.payload as Record<string, unknown>)?.claimed_at;
    return !claimedAt || now - new Date(String(claimedAt)).getTime() > CLAIM_TTL_MS;
  });

  const commands = [];
  for (const c of deliverable) {
    const payload = c.payload as Record<string, unknown>;
    await admin
      .from('commands')
      .update({ payload: { ...payload, claimed_at: new Date().toISOString() } })
      .eq('id', c.id);
    commands.push({ id: c.id, action: payload.action, params: payload.params ?? {} });
  }

  return Response.json({ commands });
}
