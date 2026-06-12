/**
 * Speech-to-text provider abstraction.
 *
 * The MVP uses the browser's Web Speech API on the client; this server-side
 * interface exists so /api/transcribe can accept recorded audio (the
 * fallback path on browsers without SpeechRecognition) once an external STT
 * service is plugged in.
 *
 * To add a provider: implement STTProvider and register it in getSTT().
 */
export interface STTProvider {
  readonly name: string;
  transcribe(audio: Blob, mimeType: string): Promise<string>;
}

export function getSTT(): STTProvider | null {
  // No external STT provider configured yet. Candidates: Deepgram,
  // AssemblyAI, Groq Whisper. See docs/roadmap.md (Fase 2).
  return null;
}
