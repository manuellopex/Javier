'use client';

import type { AssistantStatus } from '@/types';

const STATUS_META: Record<AssistantStatus, { label: string; dot: string }> = {
  online: { label: 'Online', dot: 'bg-aura-accent' },
  listening: { label: 'Listening', dot: 'bg-aura-accent animate-orb-listen' },
  thinking: { label: 'Thinking', dot: 'bg-aura-warn animate-pulse' },
  action_required: { label: 'Action Required', dot: 'bg-aura-danger animate-pulse' },
};

export function Header({
  title,
  status = 'online',
}: {
  title: string;
  status?: AssistantStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-aura-border bg-aura-bg/80 backdrop-blur-lg">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <h1 className="text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span className="text-xs font-medium text-aura-muted">{meta.label}</span>
        </div>
      </div>
    </header>
  );
}
