import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import { listEvents, createEvent } from '@/services/calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date().toISOString();
  const to =
    url.searchParams.get('to') ??
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const events = await listEvents(supabase, user.id, { from, to });
    return Response.json({ events });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to list events' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`events:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const startsAt = typeof body?.starts_at === 'string' ? body.starts_at : '';
  if (!title || !startsAt) {
    return Response.json({ error: 'title and starts_at are required' }, { status: 400 });
  }

  try {
    const event = await createEvent(supabase, user.id, {
      title,
      starts_at: startsAt,
      ends_at: body.ends_at ?? null,
      description: body.description ?? null,
      location: body.location ?? null,
      all_day: Boolean(body.all_day),
    });
    await audit({
      userId: user.id,
      event: 'event.created',
      detail: { event_id: event.id, source: event.source },
      risk: 'MEDIUM',
    });
    return Response.json({ event }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}
