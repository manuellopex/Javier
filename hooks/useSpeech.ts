'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechState = 'idle' | 'listening' | 'transcribing' | 'unsupported';

interface UseSpeechOptions {
  lang?: string;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  /**
   * Fired when a listening session ends, with whether it produced a result.
   * Hands-free mode uses this to decide when to restart listening.
   */
  onEnd?: (gotResult: boolean) => void;
}

/**
 * Voice input with two strategies:
 *  1. Web Speech API (SpeechRecognition / webkitSpeechRecognition) — live
 *     transcription in the browser. Works in Safari (incl. iOS 17+) & Chrome.
 *  2. Fallback: MediaRecorder → POST /api/transcribe (Deepgram / Groq Whisper
 *     when configured — see docs/voice.md).
 */
export function useSpeech({ lang = 'es-MX', onResult, onError, onEnd }: UseSpeechOptions) {
  const [state, setState] = useState<SpeechState>('idle');
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gotResultRef = useRef(false);
  const manualStopRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onEndRef = useRef(onEnd);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  onEndRef.current = onEnd;

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setState((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const start = useCallback(async () => {
    gotResultRef.current = false;
    manualStopRef.current = false;

    // iOS Safari exposes webkitSpeechRecognition but it is unreliable — it
    // often stays "listening" and never returns a result. On iOS we skip the
    // native API and go straight to the recorder → server STT path (Groq /
    // Deepgram), which is robust there. Native is preferred only off-iOS,
    // where it works well and has lower latency.
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const SpeechRecognition = isIOS
      ? undefined
      : ((window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

    if (SpeechRecognition) {
      // --- Strategy 1: native speech recognition ---
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognition as any)();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
        const transcript = event.results[0]?.[0]?.transcript ?? '';
        if (transcript) {
          gotResultRef.current = true;
          onResultRef.current(transcript);
        }
      };
      recognition.onerror = (event: { error: string }) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onErrorRef.current?.(`Voice error: ${event.error}`);
        }
        setState('idle');
      };
      recognition.onend = () => {
        setState('idle');
        if (!manualStopRef.current) onEndRef.current?.(gotResultRef.current);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setState('listening');
      return;
    }

    // --- Strategy 2: record audio, transcribe server-side ---
    // Auto-stops after a pause once speech is detected, so the user just
    // taps once and talks — no second tap needed.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (silenceRafRef.current) {
          cancelAnimationFrame(silenceRafRef.current);
          silenceRafRef.current = null;
        }
        if (audioCtxRef.current) {
          void audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
        // Nothing captured (e.g. instant stop) — don't call the API.
        const totalBytes = chunksRef.current.reduce((n, b) => n + b.size, 0);
        if (totalBytes < 1200) {
          setState('idle');
          if (!manualStopRef.current) onEndRef.current?.(false);
          return;
        }
        setState('transcribing');
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const form = new FormData();
          form.append('audio', blob, 'voice.webm');
          form.append('language', lang);
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Transcription failed');
          if (data.text) {
            gotResultRef.current = true;
            onResultRef.current(data.text);
          }
        } catch (err) {
          onErrorRef.current?.(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setState('idle');
          if (!manualStopRef.current) onEndRef.current?.(gotResultRef.current);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setState('listening');

      // --- Silence detection (auto-stop) -----------------------------------
      try {
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const startedAt = Date.now();
        let speechStarted = false;
        let lastLoudAt = Date.now();
        const SILENCE_MS = 1400; // pause after speech that ends the turn
        const MAX_MS = 20_000; // hard cap
        const NO_SPEECH_TIMEOUT_MS = 6000; // give up if they never speak
        const THRESHOLD = 0.04; // RMS level counted as "speaking"

        const tick = () => {
          if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = sum / data.length / 255;
          const now = Date.now();

          if (level > THRESHOLD) {
            speechStarted = true;
            lastLoudAt = now;
          }

          const elapsed = now - startedAt;
          const quietFor = now - lastLoudAt;
          const shouldStop =
            elapsed > MAX_MS ||
            (speechStarted && quietFor > SILENCE_MS) ||
            (!speechStarted && elapsed > NO_SPEECH_TIMEOUT_MS);

          if (shouldStop) {
            silenceRafRef.current = null;
            // Guarded at the top of tick: state is 'recording' | 'paused' here.
            recorderRef.current.stop();
            return;
          }
          silenceRafRef.current = requestAnimationFrame(tick);
        };
        silenceRafRef.current = requestAnimationFrame(tick);
      } catch {
        // Analyser unavailable — falls back to manual tap-to-stop.
      }
    } catch {
      setState('unsupported');
      onErrorRef.current?.('Microphone access denied or unsupported browser.');
    }
  }, [lang]);

  useEffect(() => stop, [stop]);

  return { state, start, stop, isListening: state === 'listening' };
}
