import { createClient } from '@/lib/supabase/server';
import { isGoogleConfigured, getGoogleIntegration } from '@/lib/integrations/google-calendar';
import { getEmail } from '@/services/email';
import { getTTS } from '@/services/tts';
import { getSTT } from '@/services/stt';

export const dynamic = 'force-dynamic';

/** Aggregated integration status for the Integrations view. */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const google = await getGoogleIntegration(supabase, user.id);
  const email = getEmail();
  const tts = getTTS();
  const stt = getSTT();

  // Desktop agent connectivity from its heartbeat (poll every ~7s).
  const { data: agentRow } = await supabase
    .from('integrations')
    .select('config')
    .eq('user_id', user.id)
    .eq('kind', 'desktop_agent')
    .maybeSingle();
  const agentConfig = (agentRow?.config ?? {}) as {
    last_seen?: string;
    hostname?: string | null;
  };
  const lastSeen = agentConfig.last_seen ? new Date(agentConfig.last_seen).getTime() : 0;
  const desktopConnected = Date.now() - lastSeen < 60_000;

  return Response.json({
    googleCalendar: { available: isGoogleConfigured(), connected: Boolean(google) },
    email: { configured: Boolean(email), provider: email?.name ?? null },
    tts: { configured: Boolean(tts), provider: tts?.name ?? null },
    stt: { configured: Boolean(stt), provider: stt?.name ?? null },
    shortcuts: { configured: Boolean(process.env.SHORTCUT_API_KEY) },
    desktopAgent: {
      configured: Boolean(process.env.DESKTOP_AGENT_KEY),
      connected: desktopConnected,
      last_seen: agentConfig.last_seen ?? null,
      hostname: agentConfig.hostname ?? null,
    },
  });
}
