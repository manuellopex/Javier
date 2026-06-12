import { createClient } from '@/lib/supabase/server';
import { INTEGRATION_KIND } from '@/lib/integrations/google-calendar';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

/** Disconnects Google Calendar (deletes stored tokens). */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('kind', INTEGRATION_KIND);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'integration.google.disconnected',
    detail: {},
    risk: 'MEDIUM',
  });
  return Response.json({ ok: true });
}
