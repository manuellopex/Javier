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
  if (typeof body.title === 'string') update.title = body.title.slice(0, 300);
  if (typeof body.content === 'string') update.content = body.content.slice(0, 20000);
  if (typeof body.amount === 'number' || body.amount === null) update.amount = body.amount;
  if (['draft', 'sent', 'accepted', 'rejected'].includes(body.status)) update.status = body.status;

  if (Object.keys(update).length === 0)
    return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabase
    .from('quotes')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'quote.updated',
    detail: { quote_id: params.id, fields: Object.keys(update) },
    risk: 'MEDIUM',
  });
  return Response.json({ quote: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'quote.deleted',
    detail: { quote_id: params.id },
    risk: 'HIGH',
  });
  return Response.json({ ok: true });
}
