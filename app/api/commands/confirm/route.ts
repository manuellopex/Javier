import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Resolves a pending command: { commandId, approve: boolean }.
 * On approval the action is executed here, with the user's own session
 * (RLS enforced) — this endpoint is the single gate for HIGH/CRITICAL actions.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`confirm:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const commandId = typeof body?.commandId === 'string' ? body.commandId : null;
  const approve = body?.approve === true;
  if (!commandId) return Response.json({ error: 'commandId is required' }, { status: 400 });

  const { data: command } = await supabase
    .from('commands')
    .select('*')
    .eq('id', commandId)
    .eq('user_id', user.id)
    .single();

  if (!command) return Response.json({ error: 'Command not found' }, { status: 404 });
  if (command.status !== 'pending') {
    return Response.json({ error: `Command already ${command.status}` }, { status: 409 });
  }

  const ip = clientIp(req);

  if (!approve) {
    await supabase
      .from('commands')
      .update({ status: 'denied', resolved_at: new Date().toISOString() })
      .eq('id', commandId);
    await audit({
      userId: user.id,
      event: 'command.denied',
      detail: { command_id: commandId, action: command.action },
      risk: command.risk,
      ip,
    });
    return Response.json({ ok: true, status: 'denied' });
  }

  try {
    await executeConfirmedCommand(supabase, user.id, command.action, command.payload);
    await supabase
      .from('commands')
      .update({ status: 'executed', resolved_at: new Date().toISOString() })
      .eq('id', commandId);
    await audit({
      userId: user.id,
      event: 'command.executed',
      detail: { command_id: commandId, action: command.action, payload: command.payload },
      risk: command.risk,
      ip,
    });
    return Response.json({ ok: true, status: 'executed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'execution failed';
    await supabase
      .from('commands')
      .update({ status: 'failed', resolved_at: new Date().toISOString() })
      .eq('id', commandId);
    await audit({
      userId: user.id,
      event: 'command.failed',
      detail: { command_id: commandId, action: command.action, error: message },
      risk: command.risk,
      ip,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

async function executeConfirmedCommand(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  switch (action) {
    case 'delete_task': {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', String(payload.task_id))
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
    case 'delete_memory': {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', String(payload.memory_id))
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
    default:
      throw new Error(
        `Action "${action}" has no executor yet (integration not configured in this version).`
      );
  }
}
