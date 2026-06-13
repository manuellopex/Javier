import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

const TYPES = [
  'idea', 'hook', 'script', 'caption', 'thumbnail', 'calendar',
  'report', 'reference', 'playlist', 'email', 'post', 'sop', 'brief',
];

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const platform = url.searchParams.get('platform');

  let query = supabase
    .from('contents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (type && type !== 'all') {
    // comma-separated list supported: type=idea,hook,script
    const types = type.split(',').filter((t) => TYPES.includes(t));
    if (types.length === 1) query = query.eq('type', types[0]);
    else if (types.length > 1) query = query.in('type', types);
  }
  if (platform && platform !== 'all') query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ contents: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`contents:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const type = TYPES.includes(body?.type) ? body.type : null;
  if (!title || !type) return Response.json({ error: 'type and title are required' }, { status: 400 });

  const { data, error } = await supabase
    .from('contents')
    .insert({
      user_id: user.id,
      type,
      title: title.slice(0, 300),
      body: typeof body.body === 'string' ? body.body.slice(0, 50000) : '',
      platform: typeof body.platform === 'string' ? body.platform : null,
      source_url: typeof body.source_url === 'string' ? body.source_url : null,
      project_id: typeof body.project_id === 'string' && body.project_id ? body.project_id : null,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'content.created',
    detail: { content_id: data.id, type },
    risk: 'MEDIUM',
  });
  return Response.json({ content: data }, { status: 201 });
}
