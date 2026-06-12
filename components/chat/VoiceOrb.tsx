'use client';

import { useMicLevel } from '@/hooks/useMicLevel';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const LABELS: Record<OrbState, string> = {
  idle: 'En espera',
  listening: 'Escuchando…',
  thinking: 'Pensando…',
  speaking: 'Hablando…',
};

/**
 * Audio-reactive presence orb for hands-free mode.
 * While listening it scales with the live microphone level (WebAudio
 * analyser); thinking shows a rotating ring; speaking pulses.
 */
export function VoiceOrb({ state, onExit }: { state: OrbState; onExit: () => void }) {
  const level = useMicLevel(state === 'listening');
  const scale = state === 'listening' ? 1 + level * 0.45 : 1;
  const glow =
    state === 'listening'
      ? 0.25 + level * 0.55
      : state === 'speaking'
        ? 0.45
        : state === 'thinking'
          ? 0.3
          : 0.18;

  return (
    <div className="glass-raised mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-3">
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          {/* thinking ring */}
          {state === 'thinking' && (
            <span className="absolute inset-0 animate-orb-think rounded-full border-2 border-aura-warn/60 border-t-transparent" />
          )}
          {/* speaking ripple */}
          {state === 'speaking' && (
            <span className="absolute inset-0 rounded-full border border-aura-accent/50 animate-orb-listen" />
          )}
          {/* core */}
          <span
            className={`block h-8 w-8 rounded-full transition-transform duration-75 ${
              state === 'thinking'
                ? 'bg-aura-warn/80'
                : state === 'idle'
                  ? 'bg-aura-accent/60 animate-breathe'
                  : 'bg-aura-accent'
            }`}
            style={{
              transform: `scale(${scale})`,
              boxShadow: `0 0 ${24 + glow * 50}px rgba(57, 210, 192, ${glow})`,
            }}
          />
        </div>
        <div>
          <p className="text-sm font-medium">{LABELS[state]}</p>
          <p className="text-[10px] uppercase tracking-widest text-aura-muted">
            Hands-free · auto-send
          </p>
        </div>
      </div>
      <button
        onClick={onExit}
        className="rounded-lg border border-aura-border px-3 py-1.5 text-xs text-aura-muted transition hover:bg-aura-raised hover:text-aura-text"
      >
        Exit
      </button>
    </div>
  );
}
