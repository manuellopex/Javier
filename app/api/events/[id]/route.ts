import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/security/audit';
import { deleteEvent } from '@/services/calendar';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const source = url.searchParams.get('source') === 'google' ? 'google' : 'local';

  try {
    // Direct UI deletion: the user's click is the confirmation (same policy
    // as tasks). Assistant-initiated deletions go through the command queue.
    await deleteEvent(supabase, user.id, params.id, source);
    await audit({
      userId: user.id,
      event: 'event.deleted',
      detail: { event_id: params.id, source },
      risk: 'HIGH',
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}
