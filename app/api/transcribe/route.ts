import { createClient } from '@/lib/supabase/server';
import { getSTT } from '@/services/stt';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Audio transcription fallback for browsers without the Web Speech API.
 * Accepts multipart/form-data with an `audio` file. Requires an external
 * STT provider to be configured in services/stt.ts.
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
          'No speech-to-text provider configured. Voice input currently requires a browser with Web Speech API support (Safari/Chrome). To enable server-side transcription, implement a provider in services/stt.ts.',
      },
      { status: 501 }
    );
  }

  const form = await req.formData();
  const audio = form.get('audio');
  if (!(audio instanceof Blob)) {
    return Response.json({ error: 'audio file is required' }, { status: 400 });
  }

  const text = await stt.transcribe(audio, audio.type || 'audio/webm');
  return Response.json({ text });
}
