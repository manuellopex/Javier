import { createClient } from '@/lib/supabase/server';
import { publicAgents } from '@/lib/agents/registry';

export const dynamic = 'force-dynamic';

/** Public agent descriptors (no system prompts) for the UI. */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({ agents: publicAgents() });
}
