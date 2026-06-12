'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/layout/Header';
import { formatDate } from '@/lib/utils';
import type { MemoryEntry } from '@/types';

export function MemoryView() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(q?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemories(data.memories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(search.trim() || undefined), 250);
    return () => clearTimeout(t);
  }, [search]);

  async function addMemory(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent('');
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    });
    const data = await res.json();
    if (res.ok) setMemories((prev) => [data.memory, ...prev]);
    else setError(data.error ?? 'Could not save memory');
  }

  async function deleteMemory(id: string) {
    if (!confirm('Delete this memory permanently?')) return;
    const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
    if (res.ok) setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <>
      <Header title="Memory" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-xs text-aura-muted">
            Lo que AURA recuerda entre conversaciones. Tú tienes el control: agrega o elimina lo
            que quieras.
          </p>

          <form onSubmit={addMemory} className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Remember that…"
              className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
            />
            <button
              type="submit"
              disabled={!content.trim()}
              className="rounded-xl bg-aura-accent px-4 py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
            >
              Save
            </button>
          </form>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            className="w-full rounded-xl border border-aura-border bg-aura-bg px-4 py-2 text-sm outline-none transition focus:border-aura-accent/60"
          />

          {error && <p className="text-xs text-aura-danger">{error}</p>}

          {loading ? (
            <p className="py-8 text-center text-sm text-aura-muted">Loading…</p>
          ) : memories.length === 0 ? (
            <p className="py-8 text-center text-sm text-aura-muted">No memories stored.</p>
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li key={m.id} className="glass group flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{m.content}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-aura-muted">
                      {m.category} · {m.source === 'assistant' ? 'saved by AURA' : 'saved by you'} ·{' '}
                      {formatDate(m.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    aria-label="Delete memory"
                    className="hidden shrink-0 text-xs text-aura-muted transition hover:text-aura-danger group-hover:block"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
