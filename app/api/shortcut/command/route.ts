import crypto from 'node:crypto';
import { createAdminClient, getOwnerUserId } from '@/lib/supabase/admin';
import { getLLM } from '@/lib/ai';
import { SHORTCUT_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { audit } from '@/lib/security/audit';
import { executeTool } from '@/services/assistant';
import { ASSISTANT_TOOLS } from '@/lib/ai/tools';
import type { LLMContentBlock, LLMMessage } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Apple Shortcuts endpoint.
 *
 * Auth: personal API key (SHORTCUT_API_KEY env) sent as the `x-aura-key`
 * header or `key` field in the JSON body. Constant-time comparison.
 *
 * Request:  POST { "text": "recuérdame llamar a Rob mañana" }
 * Response: { "reply": "Listo. Tarea creada para mañana." }
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = rateLimit(`shortcut:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const expectedKey = process.env.SHORTCUT_API_KEY;
  if (!expectedKey) {
    return Response.json({ error: 'Shortcut endpoint not configured' }, { status: 503 });
  }

  let body: { text?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const providedKey = req.headers.get('x-aura-key') ?? body.key ?? '';
  if (!timingSafeEqual(providedKey, expectedKey)) {
    await audit({
      userId: null,
      event: 'shortcut.auth_failed',
      detail: {},
      risk: 'HIGH',
      ip,
    });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const text = body.text?.trim();
  if (!text) return Response.json({ error: 'text is required' }, { status: 400 });
  if (text.length > 2000)
    return Response.json({ error: 'text too long (max 2000 chars)' }, { status: 400 });

  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    return Response.json(
      { error: 'Owner account not found. Set ALLOWED_EMAIL and create the user in Supabase.' },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  await audit({
    userId: ownerId,
    event: 'shortcut.command',
    detail: { length: text.length },
    ip,
  });

  try {
    // Short tool loop (max 3 rounds) with the same permission gating as web chat.
    const llm = getLLM();
    const messages: LLMMessage[] = [
      { role: 'user', content: `Current date: ${new Date().toISOString()}\n\n${text}` },
    ];
    let reply = '';

    for (let round = 0; round < 3; round++) {
      const turn = await llm.streamTurn({
        system: SHORTCUT_SYSTEM_PROMPT,
        messages,
        tools: ASSISTANT_TOOLS,
        maxTokens: 1024,
        callbacks: { onTextDelta: () => {} },
      });

      reply = turn.text || reply;
      if (turn.stopReason !== 'tool_use' || turn.toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: turn.assistantContent });
      const results: LLMContentBlock[] = [];
      for (const use of turn.toolUses) {
        const execution = await executeTool(admin, ownerId, null, use.name, use.input);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: execution.result,
          is_error: execution.isError,
        });
      }
      messages.push({ role: 'user', content: results });
    }

    // Persist as a conversation so it shows up in history.
    const { data: conversation } = await admin
      .from('conversations')
      .insert({ user_id: ownerId, title: text.slice(0, 80), source: 'shortcut' })
      .select('id')
      .single();
    if (conversation) {
      await admin.from('messages').insert([
        { conversation_id: conversation.id, user_id: ownerId, role: 'user', content: text },
        {
          conversation_id: conversation.id,
          user_id: ownerId,
          role: 'assistant',
          content: reply || '(no response)',
        },
      ]);
    }

    return Response.json({ reply: reply || 'Done.' });
  } catch (err) {
    console.error('[api/shortcut]', err);
    return Response.json({ error: 'Assistant error' }, { status: 500 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep timing constant, then fail.
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
