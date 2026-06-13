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
  const projectId = url.searchParams.get('project_id');

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') query = query.eq('status', status);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tasks: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`tasks:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: title.slice(0, 500),
      notes: typeof body.notes === 'string' ? body.notes : null,
      priority: ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium',
      due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'task.created', detail: { task_id: data.id }, risk: 'MEDIUM' });
  return Response.json({ task: data }, { status: 201 });
}
