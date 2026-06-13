import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'all';

  let query = supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .limit(200);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ clients: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`clients:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('clients')
    .insert({
      user_id: user.id,
      name: name.slice(0, 200),
      company: typeof body.company === 'string' ? body.company : null,
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
      status: ['lead', 'active', 'archived'].includes(body.status) ? body.status : 'lead',
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'client.created', detail: { client_id: data.id }, risk: 'MEDIUM' });
  return Response.json({ client: data }, { status: 201 });
}
