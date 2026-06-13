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
  for (const field of ['name', 'contact', 'segment', 'interest', 'notes'] as const) {
    if (typeof body[field] === 'string' || body[field] === null) update[field] = body[field];
  }
  if (['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'].includes(body.status))
    update.status = body.status;
  if (typeof body.value_estimate === 'number' || body.value_estimate === null)
    update.value_estimate = body.value_estimate;
  if (body.touched === true) update.last_contact_at = new Date().toISOString();

  if (Object.keys(update).length === 0)
    return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabase
    .from('leads')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'lead.updated',
    detail: { lead_id: params.id, fields: Object.keys(update) },
    risk: 'MEDIUM',
  });
  return Response.json({ lead: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'lead.deleted', detail: { lead_id: params.id }, risk: 'HIGH' });
  return Response.json({ ok: true });
}
