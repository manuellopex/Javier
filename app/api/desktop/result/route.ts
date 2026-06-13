import { createAdminClient, getOwnerUserId } from '@/lib/supabase/admin';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import { authorizeAgent } from '@/lib/security/agent-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Desktop agent result report:
 *   { commandId, ok: boolean, result?: unknown, error?: string }
 * Transitions the command approved → executed/failed and stores the output
 * (visible in the Approvals view).
 */
export async function POST(req: Request) {
  const limit = rateLimit(`desktop-result:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!process.env.DESKTOP_AGENT_KEY || !authorizeAgent(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = await getOwnerUserId();
  if (!ownerId) return Response.json({ error: 'Owner account not found' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    commandId?: string;
    ok?: boolean;
    result?: unknown;
    error?: string;
  } | null;
  if (!body?.commandId) return Response.json({ error: 'commandId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: command } = await admin
    .from('commands')
    .select('id, payload, status, risk')
    .eq('id', body.commandId)
    .eq('user_id', ownerId)
    .eq('action', 'run_desktop_command')
    .single();

  if (!command) return Response.json({ error: 'Command not found' }, { status: 404 });
  if (command.status !== 'approved') {
    return Response.json({ error: `Command is ${command.status}, not approved` }, { status: 409 });
  }

  const payload = command.payload as Record<string, unknown>;
  const result = {
    ok: body.ok === true,
    output: body.result ?? null,
    error: typeof body.error === 'string' ? body.error.slice(0, 2000) : null,
    finished_at: new Date().toISOString(),
  };

  await admin
    .from('commands')
    .update({
      status: result.ok ? 'executed' : 'failed',
      resolved_at: new Date().toISOString(),
      payload: { ...payload, result },
    })
    .eq('id', command.id);

  await audit({
    userId: ownerId,
    event: result.ok ? 'desktop.command_executed' : 'desktop.command_failed',
    detail: { command_id: command.id, action: payload.action, error: result.error },
    risk: command.risk,
    ip: clientIp(req),
  });

  return Response.json({ ok: true });
}
