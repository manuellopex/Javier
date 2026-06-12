'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { ContentCard } from './ContentLabView';
import type { ContentItem } from '@/types';

interface YTResult {
  video_id: string;
  url: string;
  title: string;
  channel: string;
  views: number | null;
  likes: number | null;
  published_at: string;
}

export function YouTubeView() {
  return (
    <Workspace
      title="YouTube Research"
      agentId="youtube-research"
      agentName="YouTube Research"
      suggestions={[
        'Busca los videos más vistos sobre day trading del último año',
        'Analiza qué títulos funcionan en mi nicho',
        'Crea un reporte de oportunidades con formatos adaptables a reels',
      ]}
    >
      {(refreshKey) => <YouTubeData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function YouTubeData({ refreshKey }: { refreshKey: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YTResult[]>([]);
  const [references, setReferences] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/contents?type=reference,report&platform=youtube')
      .then((r) => r.json())
      .then((d) => setReferences(d.contents ?? []));
  }, [refreshKey]);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}&order=viewCount`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveReference(r: YTResult) {
    const res = await fetch('/api/contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'reference',
        title: `${r.title} — ${r.channel}`,
        body: `Views: ${r.views?.toLocaleString() ?? '—'} · Likes: ${r.likes?.toLocaleString() ?? '—'} · Publicado: ${r.published_at.slice(0, 10)}`,
        platform: 'youtube',
        source_url: r.url,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setReferences((prev) => [data.content, ...prev]);
    }
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete this reference permanently?')) return;
    const res = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
    if (res.ok) setReferences((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar videos por tema…"
          className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="rounded-xl bg-aura-accent px-4 py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>
      {error && <p className="text-xs text-aura-danger">{error}</p>}

      {results.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aura-muted">
            Resultados (por views)
          </h3>
          <ul className="space-y-1.5">
            {results.map((r) => (
              <li key={r.video_id} className="glass flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm hover:text-aura-accent"
                  >
                    {r.title}
                  </a>
                  <p className="truncate text-xs text-aura-muted">
                    {r.channel} · {r.published_at.slice(0, 10)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-aura-accent">
                  {r.views ? `${r.views.toLocaleString()} views` : '—'}
                </span>
                <button
                  onClick={() => saveReference(r)}
                  className="shrink-0 rounded-lg border border-aura-border px-2 py-1 text-[10px] text-aura-muted transition hover:border-aura-accent/50 hover:text-aura-accent"
                >
                  Save ref
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aura-muted">
          Referencias y reportes guardados
        </h3>
        {references.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Sin referencias aún. Busca arriba y guarda, o pide al agente un reporte de
            oportunidades.
          </p>
        ) : (
          <ul className="space-y-2">
            {references.map((c) => (
              <ContentCard key={c.id} item={c} onDelete={() => deleteContent(c.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
