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
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setState((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const start = useCallback(async () => {
    gotResultRef.current = false;
    manualStopRef.current = false;

    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
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
    } catch {
      setState('unsupported');
      onErrorRef.current?.('Microphone access denied or unsupported browser.');
    }
  }, [lang]);

  useEffect(() => stop, [stop]);

  return { state, start, stop, isListening: state === 'listening' };
}
