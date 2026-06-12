import { createClient } from '@/lib/supabase/server';
import { getTTS } from '@/services/tts';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TTS_CHARS = 2000;

/** GET → provider status (used by Settings to show what's active). */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const tts = getTTS();
  return Response.json({ configured: Boolean(tts), provider: tts?.name ?? null });
}

/** POST { text } → audio stream. 501 when no provider (client falls back to browser TTS). */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`tts:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const tts = getTTS();
  if (!tts) {
    return Response.json(
      { error: 'No TTS provider configured. The client should use browser speechSynthesis.' },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!raw) return Response.json({ error: 'text is required' }, { status: 400 });

  // Strip markdown so the voice doesn't read symbols; cap length for cost.
  const text = raw
    .replace(/```[\s\S]*?```/g, ' (código omitido) ')
    .replace(/[*_#`>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .slice(0, MAX_TTS_CHARS);

  try {
    const stream = await tts.synthesize(text, typeof body?.language === 'string' ? body.language : undefined);
    return new Response(stream, {
      headers: { 'Content-Type': tts.contentType, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[api/tts]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'TTS failed' },
      { status: 502 }
    );
  }
}
