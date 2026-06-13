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
  const clientId = url.searchParams.get('client_id');

  let query = supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ quotes: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`quotes:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const clientId = typeof body?.client_id === 'string' ? body.client_id : '';
  if (!title || !content || !clientId) {
    return Response.json({ error: 'client_id, title and content are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      user_id: user.id,
      client_id: clientId,
      title: title.slice(0, 300),
      content: content.slice(0, 20000),
      amount: typeof body.amount === 'number' ? body.amount : null,
      currency:
        typeof body.currency === 'string' ? body.currency.slice(0, 3).toUpperCase() : 'USD',
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'quote.created', detail: { quote_id: data.id }, risk: 'MEDIUM' });
  return Response.json({ quote: data }, { status: 201 });
}
