'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { formatDate } from '@/lib/utils';
import type { Command } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-aura-warn/40 text-aura-warn',
  executed: 'border-aura-accent/40 text-aura-accent',
  denied: 'border-aura-muted/40 text-aura-muted',
  failed: 'border-aura-danger/40 text-aura-danger',
  expired: 'border-aura-muted/40 text-aura-muted',
  approved: 'border-aura-accent/40 text-aura-accent',
};

export function CommandsView() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/commands');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommands(data.commands ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commands');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(commandId: string, approve: boolean) {
    const res = await fetch('/api/commands/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId, approve }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Could not resolve command');
      return;
    }
    load();
  }

  const pending = commands.filter((c) => c.status === 'pending');
  const resolved = commands.filter((c) => c.status !== 'pending');

  return (
    <>
      <Header title="Commands" status={pending.length > 0 ? 'action_required' : 'online'} />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-xs text-aura-muted">
            Acciones HIGH/CRITICAL solicitadas por el asistente. Nada se ejecuta sin tu
            aprobación explícita. Todo queda en el log de auditoría.
          </p>

          {error && <p className="text-xs text-aura-danger">{error}</p>}
          {loading && <p className="py-8 text-center text-sm text-aura-muted">Loading…</p>}

          {!loading && pending.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-warn">
                Pending confirmation
              </h3>
              {pending.map((c) => (
                <div key={c.id} className="glass-raised border-aura-warn/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-aura-warn/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-aura-warn">
                      {c.risk}
                    </span>
                    <span className="text-[10px] text-aura-muted">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="mb-1 text-sm">{c.description}</p>
                  <p className="mb-3 font-mono text-[10px] text-aura-muted">
                    {c.action} · {JSON.stringify(c.payload)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve(c.id, true)}
                      className="rounded-lg bg-aura-warn px-4 py-2 text-xs font-semibold text-aura-bg transition hover:brightness-110"
                    >
                      Approve & execute
                    </button>
                    <button
                      onClick={() => resolve(c.id, false)}
                      className="rounded-lg border border-aura-border px-4 py-2 text-xs text-aura-muted transition hover:bg-aura-raised"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {!loading && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
                Recent commands
              </h3>
              {resolved.length === 0 ? (
                <p className="text-sm text-aura-muted">No resolved commands yet.</p>
              ) : (
                resolved.map((c) => (
                  <div key={c.id} className="glass flex items-center gap-3 px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[c.status] ?? ''}`}
                    >
                      {c.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.description}</span>
                    <span className="shrink-0 text-[10px] text-aura-muted">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
