'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Microphone level (0..1) via WebAudio AnalyserNode, for the reactive orb.
 * Best-effort: if the mic can't be opened (or SpeechRecognition holds it
 * exclusively on some platforms), level stays 0 and the orb falls back to
 * its CSS animation.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setLevel(Math.min(1, (sum / data.length / 255) * 2.5));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();

        cleanupRef.current = () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          source.disconnect();
          void ctx.close();
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch {
        // mic unavailable — silent fallback
      }
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setLevel(0);
    };
  }, [active]);

  return level;
}
