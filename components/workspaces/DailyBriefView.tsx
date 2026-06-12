'use client';

import { useEffect, useState } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { ContentCard } from './ContentLabView';
import type { ContentItem } from '@/types';

export function DailyBriefView() {
  return (
    <Workspace
      title="Daily Brief"
      agentId="daily-strategy"
      agentName="Daily Strategy"
      suggestions={[
        'Genera mi brief de hoy',
        '¿Cuál es mi próxima mejor acción ahora mismo?',
        'Tengo 2 horas libres — ¿en qué las invierto?',
        '¿Qué bloqueos tengo pendientes?',
      ]}
    >
      {(refreshKey) => <BriefData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function BriefData({ refreshKey }: { refreshKey: number }) {
  const [briefs, setBriefs] = useState<ContentItem[]>([]);

  useEffect(() => {
    fetch('/api/contents?type=report,brief')
      .then((r) => r.json())
      .then((d) =>
        setBriefs(
          (d.contents ?? []).filter((c: ContentItem) =>
            c.title.toLowerCase().startsWith('brief')
          )
        )
      );
  }, [refreshKey]);

  async function deleteContent(id: string) {
    if (!confirm('Delete this brief permanently?')) return;
    const res = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
    if (res.ok) setBriefs((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="glass p-5">
        <h3 className="mb-1 text-sm font-medium">Cómo funciona</h3>
        <p className="text-xs leading-relaxed text-aura-muted">
          El Daily Strategy Agent lee tus datos reales — tareas pendientes, agenda de hoy, leads
          sin seguimiento, deadlines de proyectos y aprobaciones bloqueadas — y entrega un brief
          priorizado por <strong className="text-aura-text">impacto económico</strong>: agenda,
          top 3 del día, bloqueos, oportunidades y <em>una</em> próxima mejor acción. Pídeselo en
          el chat → «Genera mi brief de hoy». Cada brief se archiva aquí.
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-aura-muted">
          Briefs anteriores
        </h3>
        {briefs.length === 0 ? (
          <p className="glass px-4 py-3 text-xs text-aura-muted">
            Aún no hay briefs. Genera el primero desde el chat del agente →
          </p>
        ) : (
          <ul className="space-y-2">
            {briefs.map((c) => (
              <ContentCard key={c.id} item={c} onDelete={() => deleteContent(c.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
