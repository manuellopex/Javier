'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Spoken replies with two strategies:
 *  1. POST /api/tts → streamed audio from the configured provider (ElevenLabs).
 *  2. Fallback (or 501 from the server): browser speechSynthesis.
 *
 * `speak()` resolves when playback finishes — hands-free mode relies on this
 * to resume listening at the right moment.
 */
export function useTTS(lang = 'es-MX') {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);
  const primedRef = useRef(false);

  /**
   * iOS Safari only lets speech/audio start from a user gesture. Call this
   * synchronously inside a tap/click handler (send button, mic) to "unlock"
   * playback so a later programmatic speak() (after the async reply) works.
   */
  const prime = useCallback(() => {
    if (primedRef.current || typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
        window.speechSynthesis.resume();
      }
      primedRef.current = true;
    } catch {
      // ignore — falls back to whatever the browser allows
    }
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;
      stop();
      cancelledRef.current = false;
      setSpeaking(true);

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: lang }),
        });

        if (cancelledRef.current) return;

        if (res.ok) {
          const blob = await res.blob();
          if (cancelledRef.current) return;
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            const finish = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.onpause = () => {
              // stop() pauses mid-playback
              if (cancelledRef.current) finish();
            };
            audio.play().catch(() => {
              // Autoplay blocked (e.g. iOS without recent user gesture) —
              // fall back to browser TTS which is more permissive.
              finish();
              void speakWithBrowser(text, lang, cancelledRef);
            });
          });
          return;
        }

        // 501 (not configured) or provider error → browser fallback.
        await speakWithBrowser(text, lang, cancelledRef);
      } finally {
        audioRef.current = null;
        setSpeaking(false);
      }
    },
    [lang, stop]
  );

  return { speak, stop, prime, speaking };
}

function speakWithBrowser(
  text: string,
  lang: string,
  cancelledRef: { current: boolean }
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve();
    if (cancelledRef.current) return resolve();

    const plain = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_#`>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .slice(0, 1500);

    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    // iOS can leave the queue paused; nudge it.
    window.speechSynthesis.resume();
  });
}
