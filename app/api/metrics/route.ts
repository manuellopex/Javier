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
  const platform = url.searchParams.get('platform');

  let query = supabase
    .from('content_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (platform && platform !== 'all') query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ metrics: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`metrics:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.platform !== 'string') {
    return Response.json({ error: 'platform is required' }, { status: 400 });
  }

  const numeric = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };

  const { data, error } = await supabase
    .from('content_metrics')
    .insert({
      user_id: user.id,
      platform: body.platform,
      ref: typeof body.ref === 'string' ? body.ref : null,
      content_id: typeof body.content_id === 'string' && body.content_id ? body.content_id : null,
      views: numeric(body.views),
      likes: numeric(body.likes),
      comments: numeric(body.comments),
      shares: numeric(body.shares),
      saves: numeric(body.saves),
      follows: numeric(body.follows),
      watch_seconds: numeric(body.watch_seconds),
      posted_at: body.posted_at ? new Date(body.posted_at).toISOString() : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'metrics.logged',
    detail: { metric_id: data.id, platform: body.platform },
    risk: 'MEDIUM',
  });
  return Response.json({ metric: data }, { status: 201 });
}
