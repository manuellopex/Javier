import { createClient } from '@/lib/supabase/server';
import { getSTT } from '@/services/stt';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET → provider status (used by Settings to show what's active). */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stt = getSTT();
  return Response.json({ configured: Boolean(stt), provider: stt?.name ?? null });
}

/**
 * Audio transcription for browsers without the Web Speech API (or when a
 * higher-quality provider is preferred). multipart/form-data:
 *   audio    — recorded file (webm/mp4/ogg)
 *   language — optional BCP-47 hint, e.g. "es-MX"
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`transcribe:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const stt = getSTT();
  if (!stt) {
    return Response.json(
      {
        error:
          'No speech-to-text provider configured. Set DEEPGRAM_API_KEY or GROQ_API_KEY (see docs/voice.md). Browsers with Web Speech API support do not need this endpoint.',
      },
      { status: 501 }
    );
  }

  const form = await req.formData();
  const audio = form.get('audio');
  if (!(audio instanceof Blob)) {
    return Response.json({ error: 'audio file is required' }, { status: 400 });
  }
  if (audio.size > 20 * 1024 * 1024) {
    return Response.json({ error: 'audio too large (max 20MB)' }, { status: 413 });
  }

  const language = form.get('language');

  try {
    const text = await stt.transcribe(
      audio,
      audio.type || 'audio/webm',
      typeof language === 'string' && language ? language : undefined
    );
    return Response.json({ text, provider: stt.name });
  } catch (err) {
    console.error('[api/transcribe]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Transcription failed' },
      { status: 502 }
    );
  }
}
