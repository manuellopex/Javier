'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { ContentCard } from './ContentLabView';
import type { ContentItem } from '@/types';

interface Track {
  id: string;
  url: string;
  name: string;
  artists: string;
  album: string;
  popularity: number;
  preview_url: string | null;
}

export function MusicView() {
  return (
    <Workspace
      title="Music Finder"
      agentId="music-direction"
      agentName="Music Direction"
      suggestions={[
        'Busca música épica cinematográfica para un reel de gimnasio',
        'Arma una playlist de referencia para la campaña de TTP',
        'Clasifica estos tracks por mood y energía',
      ]}
    >
      {(refreshKey) => <MusicData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function MusicData({ refreshKey }: { refreshKey: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/contents?type=playlist,reference&platform=spotify')
      .then((r) => r.json())
      .then((d) => setPlaylists(d.contents ?? []));
  }, [refreshKey]);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveTrack(t: Track) {
    const res = await fetch('/api/contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'reference',
        title: `${t.artists} — ${t.name}`,
        body: `Álbum: ${t.album} · Popularidad: ${t.popularity}/100\n\n⚠️ Referencia: sin licencia comercial. Buscar equivalente en Artlist/Epidemic para producción final.`,
        platform: 'spotify',
        source_url: t.url,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlaylists((prev) => [data.content, ...prev]);
    }
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete permanently?')) return;
    const res = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
    if (res.ok) setPlaylists((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="glass border-aura-warn/20 px-4 py-2.5 text-[11px] text-aura-muted">
        ⚠️ Spotify es solo <strong className="text-aura-warn">referencia creativa</strong> — sin
        licencia para uso comercial en videos. Para producción final usa Artlist / Epidemic Sound.
      </p>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por vibe, género o artista…"
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
            Tracks
          </h3>
          <ul className="space-y-1.5">
            {results.map((t) => (
              <li key={t.id} className="glass flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm hover:text-aura-accent"
                  >
                    {t.name}
                  </a>
                  <p className="truncate text-xs text-aura-muted">{t.artists}</p>
                </div>
                {t.preview_url && (
                  <audio src={t.preview_url} controls preload="none" className="h-8 w-28 shrink-0" />
                )}
                <span className="shrink-0 font-mono text-[10px] text-aura-muted">
                  {t.popularity}/100
                </span>
                <button
                  onClick={() => saveTrack(t)}
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
          Playlists y referencias
        </h3>
        {playlists.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Sin playlists aún. Pide al agente: «arma una playlist de referencia para X proyecto».
          </p>
        ) : (
          <ul className="space-y-2">
            {playlists.map((c) => (
              <ContentCard key={c.id} item={c} onDelete={() => deleteContent(c.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
