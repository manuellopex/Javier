'use client';

import { useState } from 'react';
import type { Command } from '@/types';

export function PendingCommandCard({
  command,
  onResolve,
}: {
  command: Pick<Command, 'id' | 'action' | 'description' | 'risk'>;
  onResolve: (approve: boolean) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  async function handle(approve: boolean) {
    setBusy(true);
    try {
      await onResolve(approve);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-raised border-aura-warn/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-aura-warn" />
        <p className="text-xs font-semibold uppercase tracking-wider text-aura-warn">
          Confirmation required · {command.risk}
        </p>
      </div>
      <p className="mb-4 text-sm">{command.description}</p>
      <div className="flex gap-2">
        <button
          onClick={() => handle(true)}
          disabled={busy}
          className="rounded-lg bg-aura-warn px-4 py-2 text-xs font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-50"
        >
          Approve & execute
        </button>
        <button
          onClick={() => handle(false)}
          disabled={busy}
          className="rounded-lg border border-aura-border px-4 py-2 text-xs font-medium text-aura-muted transition hover:bg-aura-raised disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
