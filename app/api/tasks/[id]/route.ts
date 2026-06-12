import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.title === 'string') update.title = body.title.slice(0, 500);
  if (typeof body.notes === 'string' || body.notes === null) update.notes = body.notes;
  if (['low', 'medium', 'high'].includes(body.priority)) update.priority = body.priority;
  if (body.due_at !== undefined)
    update.due_at = body.due_at ? new Date(body.due_at).toISOString() : null;
  if (['pending', 'completed', 'archived'].includes(body.status)) {
    update.status = body.status;
    update.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
  }

  if (Object.keys(update).length === 0)
    return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'task.updated',
    detail: { task_id: params.id, fields: Object.keys(update) },
    risk: 'MEDIUM',
  });
  return Response.json({ task: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Deleting directly from the UI is an explicit user action (the user IS the
  // confirmation), unlike assistant-initiated deletions which queue a command.
  const { error } = await supabase.from('tasks').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'task.deleted', detail: { task_id: params.id }, risk: 'HIGH' });
  return Response.json({ ok: true });
}
