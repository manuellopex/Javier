'use client';

import { useEffect, useState } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { renderMarkdown, formatDate } from '@/lib/utils';
import type { ContentItem, ContentMetric } from '@/types';

const CONTENT_TABS = [
  { id: 'idea,hook', label: 'Ideas & Hooks' },
  { id: 'script', label: 'Scripts' },
  { id: 'caption,thumbnail', label: 'Captions' },
  { id: 'calendar', label: 'Calendars' },
  { id: 'report', label: 'Reports' },
] as const;

export function ContentLabView() {
  return (
    <Workspace
      title="Content Lab"
      agentId="content-growth"
      agentName="Content Growth"
      suggestions={[
        'Analiza mis métricas y dime qué patrones ganan',
        'Dame 5 ideas de reels con hooks para esta semana',
        'Crea el calendario de contenido de la próxima semana',
      ]}
    >
      {(refreshKey) => <ContentLabData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function ContentLabData({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<string>(CONTENT_TABS[0].id);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [metrics, setMetrics] = useState<ContentMetric[]>([]);
  const [showMetricForm, setShowMetricForm] = useState(false);

  useEffect(() => {
    fetch(`/api/contents?type=${tab}`)
      .then((r) => r.json())
      .then((d) => setContents(d.contents ?? []));
  }, [tab, refreshKey]);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics ?? []));
  }, [refreshKey]);

  async function deleteContent(id: string) {
    if (!confirm('Delete this content permanently?')) return;
    const res = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
    if (res.ok) setContents((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Metrics */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
            Métricas recientes {metrics.length > 0 && `(${metrics.length})`}
          </h3>
          <button
            onClick={() => setShowMetricForm((v) => !v)}
            className="rounded-lg bg-aura-accent px-3 py-1.5 text-xs font-semibold text-aura-bg transition hover:brightness-110"
          >
            + Log metrics
          </button>
        </div>
        {showMetricForm && <MetricForm onSaved={(m) => { setMetrics((prev) => [m, ...prev]); setShowMetricForm(false); }} />}
        {metrics.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Sin métricas aún. Regístralas aquí o dile al agente: «el reel de ayer hizo 80k views».
            Cuando la Instagram API esté conectada alimentará esta misma tabla.
          </p>
        ) : (
          <div className="glass overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-aura-border text-[10px] uppercase tracking-wider text-aura-muted">
                  <th className="px-3 py-2">Post</th>
                  <th className="px-3 py-2 text-right">Views</th>
                  <th className="px-3 py-2 text-right">Likes</th>
                  <th className="px-3 py-2 text-right">Saves</th>
                  <th className="px-3 py-2 text-right">Follows</th>
                  <th className="px-3 py-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 10).map((m) => (
                  <tr key={m.id} className="border-b border-aura-border/50 last:border-0">
                    <td className="max-w-[140px] truncate px-3 py-2">
                      {m.ref ? (
                        <a href={m.ref} target="_blank" rel="noopener noreferrer" className="text-aura-accent underline">
                          {m.platform}
                        </a>
                      ) : (
                        m.platform
                      )}
                      {m.posted_at && (
                        <span className="ml-1 text-aura-muted">{formatDate(m.posted_at)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{m.views?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.likes?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.saves?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{m.follows?.toLocaleString() ?? '—'}</td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-aura-muted">{m.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contents */}
      <section>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CONTENT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                tab === t.id
                  ? 'bg-aura-accent/15 font-medium text-aura-accent'
                  : 'text-aura-muted hover:bg-aura-raised'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {contents.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Nada aquí todavía — el agente guarda sus entregables en esta vista.
          </p>
        ) : (
          <ul className="space-y-2">
            {contents.map((c) => (
              <ContentCard key={c.id} item={c} onDelete={() => deleteContent(c.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ContentCard({ item, onDelete }: { item: ContentItem; onDelete: () => void }) {
  return (
    <li className="glass group">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
          <span className="rounded-full border border-aura-border px-2 py-0.5 text-[9px] font-semibold uppercase text-aura-muted">
            {item.type}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
          {item.platform && <span className="shrink-0 text-[10px] text-aura-muted">{item.platform}</span>}
          <span className="shrink-0 text-[10px] text-aura-muted">{formatDate(item.created_at)}</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            aria-label="Delete"
            className="hidden shrink-0 text-xs text-aura-muted hover:text-aura-danger group-hover:block"
          >
            ✕
          </button>
        </summary>
        <div className="border-t border-aura-border px-4 py-3">
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block truncate text-xs text-aura-accent underline"
            >
              {item.source_url}
            </a>
          )}
          <div
            className="prose-aura text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body) }}
          />
        </div>
      </details>
    </li>
  );
}

function MetricForm({ onSaved }: { onSaved: (m: ContentMetric) => void }) {
  const [form, setForm] = useState({
    platform: 'instagram',
    ref: '',
    views: '',
    likes: '',
    comments: '',
    saves: '',
    follows: '',
    posted_at: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        views: form.views ? Number(form.views) : null,
        likes: form.likes ? Number(form.likes) : null,
        comments: form.comments ? Number(form.comments) : null,
        saves: form.saves ? Number(form.saves) : null,
        follows: form.follows ? Number(form.follows) : null,
        posted_at: form.posted_at || null,
      }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data.metric);
    else setError(data.error ?? 'Could not save metrics');
  }

  const num = 'w-full rounded-lg border border-aura-border bg-aura-bg px-2 py-1.5 text-xs outline-none focus:border-aura-accent/60';

  return (
    <form onSubmit={submit} className="glass mb-3 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
      <select value={form.platform} onChange={set('platform')} className={num}>
        <option value="instagram">Instagram</option>
        <option value="youtube">YouTube</option>
        <option value="tiktok">TikTok</option>
      </select>
      <input placeholder="URL del post" value={form.ref} onChange={set('ref')} className={`${num} col-span-2`} />
      <input type="date" value={form.posted_at} onChange={set('posted_at')} className={num} />
      <input placeholder="Views" inputMode="numeric" value={form.views} onChange={set('views')} className={num} />
      <input placeholder="Likes" inputMode="numeric" value={form.likes} onChange={set('likes')} className={num} />
      <input placeholder="Saves" inputMode="numeric" value={form.saves} onChange={set('saves')} className={num} />
      <input placeholder="Follows" inputMode="numeric" value={form.follows} onChange={set('follows')} className={num} />
      <input
        placeholder="Notas (hook, formato, tema)"
        value={form.notes}
        onChange={set('notes')}
        className={`${num} col-span-2 sm:col-span-3`}
      />
      <button
        type="submit"
        className="rounded-lg bg-aura-accent px-3 py-1.5 text-xs font-semibold text-aura-bg transition hover:brightness-110"
      >
        Save
      </button>
      {error && <p className="col-span-full text-xs text-aura-danger">{error}</p>}
    </form>
  );
}
