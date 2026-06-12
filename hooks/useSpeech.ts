'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechState = 'idle' | 'listening' | 'transcribing' | 'unsupported';

interface UseSpeechOptions {
  lang?: string;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}

/**
 * Voice input with two strategies:
 *  1. Web Speech API (SpeechRecognition / webkitSpeechRecognition) — live
 *     transcription in the browser. Works in Safari (incl. iOS 17+) & Chrome.
 *  2. Fallback: MediaRecorder → POST /api/transcribe (requires a server-side
 *     STT provider; the endpoint explains itself if none is configured).
 */
export function useSpeech({ lang = 'es-MX', onResult, onError }: UseSpeechOptions) {
  const [state, setState] = useState<SpeechState>('idle');
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setState((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const start = useCallback(async () => {
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
        if (transcript) onResultRef.current(transcript);
      };
      recognition.onerror = (event: { error: string }) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onErrorRef.current?.(`Voice error: ${event.error}`);
        }
        setState('idle');
      };
      recognition.onend = () => setState('idle');

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
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Transcription failed');
          if (data.text) onResultRef.current(data.text);
        } catch (err) {
          onErrorRef.current?.(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setState('idle');
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

/** Browser text-to-speech for assistant replies (optional, see Settings). */
export function speak(text: string, lang = 'es-MX') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const plain = text
    .replace(/[*_#`>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .slice(0, 1200);
  const utterance = new SpeechSynthesisUtterance(plain);
  utterance.lang = lang;
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}
