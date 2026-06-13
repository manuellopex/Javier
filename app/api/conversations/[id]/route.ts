import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ messages: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await audit({
    userId: user.id,
    event: 'conversation.deleted',
    detail: { conversation_id: params.id },
    risk: 'HIGH',
  });
  return Response.json({ ok: true });
}
