import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import { runAssistantTurn } from '@/services/assistant';
import type { LLMMessage } from '@/lib/ai';
import type { ChatStreamEvent } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const HISTORY_LIMIT = 30;
const MEMORY_CONTEXT_LIMIT = 15;

function sse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`chat:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: { message?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return Response.json({ error: 'message is required' }, { status: 400 });
  if (message.length > 8000)
    return Response.json({ error: 'message too long (max 8000 chars)' }, { status: 400 });

  // --- Resolve or create the conversation -----------------------------------
  let conversationId = body.conversationId ?? null;
  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: message.slice(0, 80), source: 'web' })
      .select('id')
      .single();
    if (error || !data) {
      return Response.json({ error: 'Could not create conversation' }, { status: 500 });
    }
    conversationId = data.id;
  }

  // --- Persist the user message ----------------------------------------------
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: 'user',
    content: message,
  });

  // --- Load history + memory context ------------------------------------------
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: LLMMessage[] = (historyRows ?? [])
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const { data: memories } = await supabase
    .from('memories')
    .select('content, category')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MEMORY_CONTEXT_LIMIT);

  const memoriesContext = (memories ?? [])
    .map((m) => `- [${m.category}] ${m.content}`)
    .join('\n');

  await audit({
    userId: user.id,
    event: 'chat.message',
    detail: { conversation_id: conversationId, length: message.length },
    ip: clientIp(req),
  });

  // --- Stream the assistant turn as SSE ---------------------------------------
  const encoder = new TextEncoder();
  const finalConversationId = conversationId as string;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          // client disconnected — keep running so the message is persisted
        }
      };

      emit({ type: 'conversation', conversationId: finalConversationId });

      try {
        const { text, toolCalls } = await runAssistantTurn({
          supabase,
          userId: user.id,
          conversationId: finalConversationId,
          history,
          memoriesContext,
          emit,
        });

        const { data: saved } = await supabase
          .from('messages')
          .insert({
            conversation_id: finalConversationId,
            user_id: user.id,
            role: 'assistant',
            content: text || '(no response)',
            tool_calls: toolCalls.length ? toolCalls : null,
          })
          .select('id')
          .single();

        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', finalConversationId);

        emit({ type: 'done', messageId: saved?.id ?? '' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Assistant error';
        console.error('[api/chat]', err);
        emit({ type: 'error', message: msg });
        await audit({
          userId: user.id,
          event: 'chat.error',
          detail: { error: msg },
          risk: 'LOW',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
