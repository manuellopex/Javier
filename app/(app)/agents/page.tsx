import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { publicAgents } from '@/lib/agents/registry';

export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  const agents = publicAgents();

  return (
    <>
      <Header title="Agents" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="text-xs text-aura-muted">
            Todos los agentes corren sobre el mismo motor: misma matriz de riesgo, misma cola de
            aprobaciones, mismo log de auditoría. Cambia su especialización y sus herramientas.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={agent.href}
                className="glass group p-5 transition hover:border-aura-accent/40"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-aura-accent/30 bg-aura-bg text-base text-aura-accent">
                    {agent.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{agent.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-aura-muted">
                      {agent.tagline}
                    </p>
                  </div>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-aura-muted">{agent.description}</p>

                <div className="mb-2">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-aura-accent">
                    Hace solo
                  </p>
                  <ul className="space-y-0.5">
                    {agent.canDo.map((item) => (
                      <li key={item} className="text-[11px] text-aura-muted">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {agent.needsApproval.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-aura-warn">
                      Requiere tu aprobación
                    </p>
                    <ul className="space-y-0.5">
                      {agent.needsApproval.map((item) => (
                        <li key={item} className="text-[11px] text-aura-muted">
                          ⏸ {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {(agent.tools.includes('*') ? ['todas las herramientas'] : agent.tools)
                    .slice(0, 8)
                    .map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full border border-aura-border px-1.5 py-0.5 font-mono text-[8px] text-aura-muted"
                      >
                        {tool}
                      </span>
                    ))}
                  {!agent.tools.includes('*') && agent.tools.length > 8 && (
                    <span className="text-[9px] text-aura-muted">+{agent.tools.length - 8}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
