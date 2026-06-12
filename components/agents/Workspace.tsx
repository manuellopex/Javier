'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { AgentChat } from './AgentChat';

/**
 * Standard workspace shell: data panel + embedded agent chat.
 * Desktop: side by side. Mobile: tab switch.
 * The data panel re-renders (via refreshKey) after every agent turn so
 * agent-created records appear immediately.
 */
export function Workspace({
  title,
  agentId,
  agentName,
  suggestions,
  children,
}: {
  title: string;
  agentId: string;
  agentName: string;
  suggestions: string[];
  children: (refreshKey: number) => ReactNode;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<'data' | 'agent'>('data');
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <>
      <Header title={title} />
      {/* Mobile tab switch */}
      <div className="flex gap-1.5 border-b border-aura-border px-4 py-2 md:hidden">
        <button
          onClick={() => setTab('data')}
          className={`rounded-full px-3 py-1 text-xs transition ${
            tab === 'data' ? 'bg-aura-accent/15 font-medium text-aura-accent' : 'text-aura-muted'
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => setTab('agent')}
          className={`rounded-full px-3 py-1 text-xs transition ${
            tab === 'agent' ? 'bg-aura-accent/15 font-medium text-aura-accent' : 'text-aura-muted'
          }`}
        >
          ◍ {agentName}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <main
          className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 md:block md:px-6 ${
            tab === 'data' ? 'block' : 'hidden'
          }`}
        >
          {children(refreshKey)}
        </main>
        <aside
          className={`min-h-0 w-full flex-col border-aura-border md:flex md:w-[26rem] md:shrink-0 md:border-l ${
            tab === 'agent' ? 'flex' : 'hidden'
          }`}
        >
          <div className="hidden items-center gap-2 border-b border-aura-border px-4 py-2.5 md:flex">
            <span className="h-2 w-2 rounded-full bg-aura-accent animate-breathe" />
            <p className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              {agentName} Agent
            </p>
          </div>
          <AgentChat agentId={agentId} suggestions={suggestions} onActivity={bump} />
        </aside>
      </div>
    </>
  );
}
