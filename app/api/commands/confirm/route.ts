import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import { getEmail, isValidEmail } from '@/services/email';
import { deleteEvent } from '@/services/calendar';
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

  // Desktop actions are not executed here: approval hands them to the local
  // desktop agent, which picks them up on its next poll (/api/desktop/poll)
  // and reports the result back (/api/desktop/result).
  if (command.action === 'run_desktop_command') {
    await supabase
      .from('commands')
      .update({ status: 'approved' })
      .eq('id', commandId);
    await audit({
      userId: user.id,
      event: 'command.approved_for_desktop',
      detail: { command_id: commandId, payload: command.payload },
      risk: command.risk,
      ip,
    });
    return Response.json({
      ok: true,
      status: 'approved',
      note: 'Queued for the desktop agent. It executes on its next poll; the result will appear here.',
    });
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
    case 'delete_event': {
      const source = payload.source === 'google' ? 'google' : 'local';
      await deleteEvent(supabase, userId, String(payload.event_id), source);
      return;
    }
    case 'send_email': {
      const email = getEmail();
      if (!email) {
        throw new Error(
          'Email is not configured. Set RESEND_API_KEY and EMAIL_FROM (see docs/integrations.md).'
        );
      }
      const to = String(payload.to ?? '');
      if (!isValidEmail(to)) throw new Error(`Invalid recipient: ${to}`);
      await email.send({
        to,
        subject: String(payload.subject ?? '').slice(0, 300),
        text: String(payload.body ?? '').slice(0, 50000),
      });
      return;
    }
    default:
      throw new Error(
        `Action "${action}" has no executor yet (integration not configured in this version).`
      );
  }
}
