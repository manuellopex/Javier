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
  const q = url.searchParams.get('q')?.trim();

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) query = query.ilike('content', `%${q.replaceAll('%', '')}%`);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ memories: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`memory:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return Response.json({ error: 'content is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      content: content.slice(0, 2000),
      category: typeof body.category === 'string' ? body.category : 'general',
      source: 'user',
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'memory.created', detail: { memory_id: data.id }, risk: 'MEDIUM' });
  return Response.json({ memory: data }, { status: 201 });
}
