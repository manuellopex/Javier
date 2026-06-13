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
  const source = url.searchParams.get('source');

  let query = supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (status && status !== 'all') query = query.eq('status', status);
  if (source && source !== 'all') query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ leads: data });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`leads:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('leads')
    .insert({
      user_id: user.id,
      name: name.slice(0, 200),
      contact: typeof body.contact === 'string' ? body.contact : null,
      source: ['instagram', 'youtube', 'webinar', 'ttp', 'referral', 'website', 'other'].includes(
        body.source
      )
        ? body.source
        : 'other',
      segment: typeof body.segment === 'string' ? body.segment : null,
      interest: typeof body.interest === 'string' ? body.interest : null,
      value_estimate: typeof body.value_estimate === 'number' ? body.value_estimate : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({ userId: user.id, event: 'lead.created', detail: { lead_id: data.id }, risk: 'MEDIUM' });
  return Response.json({ lead: data }, { status: 201 });
}
