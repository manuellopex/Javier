'use client';

export function MicButton({
  state,
  onStart,
  onStop,
}: {
  state: 'idle' | 'listening' | 'transcribing' | 'unsupported';
  onStart: () => void;
  onStop: () => void;
}) {
  const listening = state === 'listening';

  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      disabled={state === 'transcribing'}
      aria-label={listening ? 'Stop listening' : 'Start voice input'}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
        listening
          ? 'border-aura-accent bg-aura-accent/20 text-aura-accent animate-orb-listen'
          : state === 'transcribing'
            ? 'border-aura-warn/50 text-aura-warn'
            : 'border-aura-border bg-aura-surface text-aura-muted hover:border-aura-accent/50 hover:text-aura-accent'
      }`}
    >
      {state === 'transcribing' ? (
        <span className="h-4 w-4 animate-orb-think rounded-full border-2 border-aura-warn border-t-transparent" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      )}
    </button>
  );
}
