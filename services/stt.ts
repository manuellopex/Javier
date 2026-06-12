/**
 * Speech-to-text provider abstraction (server side).
 *
 * The browser's Web Speech API remains the primary voice input. This layer
 * powers /api/transcribe — the fallback path for browsers without
 * SpeechRecognition and the higher-quality option when configured.
 *
 * Providers activate via env vars (no code changes needed):
 *   STT_PROVIDER=deepgram + DEEPGRAM_API_KEY
 *   STT_PROVIDER=groq     + GROQ_API_KEY     (Whisper large v3)
 * If STT_PROVIDER is unset, the first provider with a key wins.
 */
export interface STTProvider {
  readonly name: string;
  /** `language` is a BCP-47 hint like "es-MX"; providers normalize it. */
  transcribe(audio: Blob, mimeType: string, language?: string): Promise<string>;
}

const deepgramProvider: STTProvider = {
  name: 'deepgram',
  async transcribe(audio, mimeType, language) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY not configured');

    const params = new URLSearchParams({ model: 'nova-2', smart_format: 'true' });
    if (language) params.set('language', language.split('-')[0]);
    else params.set('detect_language', 'true');

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': mimeType },
      body: Buffer.from(await audio.arrayBuffer()),
    });
    if (!res.ok) {
      throw new Error(`Deepgram error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
  },
};

const groqWhisperProvider: STTProvider = {
  name: 'groq-whisper',
  async transcribe(audio, mimeType, language) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not configured');

    const form = new FormData();
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    form.append('file', audio, `voice.${ext}`);
    form.append('model', 'whisper-large-v3');
    if (language) form.append('language', language.split('-')[0]);

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? '';
  },
};

const providers: Record<string, { provider: STTProvider; keyEnv: string }> = {
  deepgram: { provider: deepgramProvider, keyEnv: 'DEEPGRAM_API_KEY' },
  groq: { provider: groqWhisperProvider, keyEnv: 'GROQ_API_KEY' },
};

export function getSTT(): STTProvider | null {
  const requested = process.env.STT_PROVIDER;
  if (requested) {
    const entry = providers[requested];
    if (!entry) return null;
    return process.env[entry.keyEnv] ? entry.provider : null;
  }
  for (const entry of Object.values(providers)) {
    if (process.env[entry.keyEnv]) return entry.provider;
  }
  return null;
}
