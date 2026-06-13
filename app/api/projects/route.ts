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
  const status = url.searchParams.get('status');

  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ projects: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`projects:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: name.slice(0, 300),
      kind: ['reel', 'video', 'campaign', 'webinar', 'automation', 'other'].includes(body.kind)
        ? body.kind
        : 'other',
      client_id: typeof body.client_id === 'string' && body.client_id ? body.client_id : null,
      due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'project.created',
    detail: { project_id: data.id },
    risk: 'MEDIUM',
  });
  return Response.json({ project: data }, { status: 201 });
}
