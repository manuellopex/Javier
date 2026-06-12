'use client';

import { useEffect, useState } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { ContentCard } from './ContentLabView';
import type { ContentItem, Lead } from '@/types';

const SEGMENTS = [
  { id: 'webinar_attended', label: 'Asistieron' },
  { id: 'webinar_no_show', label: 'No-shows' },
  { id: 'hot', label: 'Calientes' },
  { id: 'member', label: 'Miembros' },
  { id: 'inactive', label: 'Inactivos' },
] as const;

export function TTPGrowthView() {
  return (
    <Workspace
      title="TTP Growth"
      agentId="ttp-growth"
      agentName="TTP Growth"
      suggestions={[
        'Webinar de ayer: registra 40 asistentes y 25 no-shows',
        'Crea la secuencia de follow-up para los no-shows',
        'Redacta el post de Discord del próximo webinar',
        'Crea el SOP de onboarding para miembros nuevos',
      ]}
    >
      {(refreshKey) => <TTPData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function TTPData({ refreshKey }: { refreshKey: number }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<ContentItem[]>([]);
  const [segment, setSegment] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/leads').then((r) => r.json()),
      fetch('/api/contents?platform=ttp').then((r) => r.json()),
      fetch('/api/contents?platform=discord').then((r) => r.json()),
    ]).then(([leadsData, ttpContents, discordContents]) => {
      const ttpLeads = (leadsData.leads ?? []).filter(
        (l: Lead) => l.source === 'ttp' || l.source === 'webinar'
      );
      setLeads(ttpLeads);
      setAssets([...(ttpContents.contents ?? []), ...(discordContents.contents ?? [])]);
    });
  }, [refreshKey]);

  async function deleteContent(id: string) {
    if (!confirm('Delete permanently?')) return;
    const res = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
    if (res.ok) setAssets((prev) => prev.filter((c) => c.id !== id));
  }

  const counts = SEGMENTS.map((s) => ({
    ...s,
    count: leads.filter((l) => l.segment === s.id).length,
  }));
  const visible = segment === 'all' ? leads : leads.filter((l) => l.segment === segment);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Segments */}
      <div className="grid grid-cols-5 gap-2">
        {counts.map((s) => (
          <button
            key={s.id}
            onClick={() => setSegment(segment === s.id ? 'all' : s.id)}
            className={`glass p-2.5 text-center transition ${
              segment === s.id ? 'border-aura-accent/50' : 'hover:border-aura-accent/30'
            }`}
          >
            <p className="text-base font-semibold">{s.count}</p>
            <p className="text-[9px] uppercase tracking-wider text-aura-muted">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Audience */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aura-muted">
          Audiencia TTP {segment !== 'all' && `· ${SEGMENTS.find((s) => s.id === segment)?.label}`}
        </h3>
        {visible.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Sin leads en este segmento. Después de un webinar dile al agente: «registra 40
            asistentes y 25 no-shows» — o agrégalos en Sales Desk con source webinar/ttp.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {visible.slice(0, 30).map((lead) => (
              <li key={lead.id} className="glass flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{lead.name}</p>
                  <p className="truncate text-xs text-aura-muted">
                    {[lead.contact, lead.interest].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {lead.segment && (
                  <span className="shrink-0 rounded-full border border-aura-border px-2 py-0.5 text-[9px] uppercase text-aura-muted">
                    {SEGMENTS.find((s) => s.id === lead.segment)?.label ?? lead.segment}
                  </span>
                )}
                <span className="shrink-0 rounded-full border border-aura-accent/30 px-2 py-0.5 text-[9px] uppercase text-aura-accent">
                  {lead.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Assets: emails, posts, SOPs */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aura-muted">
          Emails, posts y SOPs
        </h3>
        {assets.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            El agente guarda aquí las secuencias de email, posts de Discord, SOPs y onboarding.
          </p>
        ) : (
          <ul className="space-y-2">
            {assets.map((c) => (
              <ContentCard key={c.id} item={c} onDelete={() => deleteContent(c.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
