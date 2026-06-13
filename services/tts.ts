/**
 * Text-to-speech provider abstraction (server side).
 *
 * Powers /api/tts. When no provider is configured the client falls back to
 * the browser's speechSynthesis automatically — voice replies always work.
 *
 * Providers activate via env vars:
 *   ELEVENLABS_API_KEY (+ optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL)
 */
export interface TTSProvider {
  readonly name: string;
  readonly contentType: string;
  /** Returns a stream of encoded audio for the given text. */
  synthesize(text: string, language?: string): Promise<ReadableStream<Uint8Array>>;
}

// "Rachel" — a default pre-made ElevenLabs voice; override with your own.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const elevenLabsProvider: TTSProvider = {
  name: 'elevenlabs',
  contentType: 'audio/mpeg',
  async synthesize(text) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('ELEVENLABS_API_KEY not configured');
    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
    const modelId = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!res.ok || !res.body) {
      throw new Error(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res.body;
  },
};

export function getTTS(): TTSProvider | null {
  const requested = process.env.TTS_PROVIDER;
  if (requested && requested !== 'elevenlabs') return null;
  return process.env.ELEVENLABS_API_KEY ? elevenLabsProvider : null;
}
