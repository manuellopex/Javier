'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { Conversation } from '@/types';

export function ConversationList({
  activeId,
  onSelect,
  onClose,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this conversation permanently?')) return;
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (res.ok) setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="absolute inset-0 z-20 flex md:relative md:w-72 md:shrink-0">
      <div className="flex w-full flex-col border-r border-aura-border bg-aura-surface/95 backdrop-blur-lg md:w-72">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-aura-muted">History</p>
          <button onClick={onClose} className="text-xs text-aura-muted hover:text-aura-text">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-xs text-aura-muted">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-aura-muted">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  c.id === activeId
                    ? 'bg-aura-accent/10 text-aura-accent'
                    : 'text-aura-muted hover:bg-aura-raised hover:text-aura-text'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{c.title}</span>
                  <span className="text-[10px] text-aura-muted">
                    {c.source === 'shortcut' ? '⌘ Shortcut · ' : ''}
                    {formatDate(c.updated_at)}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="hidden shrink-0 text-xs text-aura-muted hover:text-aura-danger group-hover:block"
                >
                  ✕
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      <button className="flex-1 bg-black/40 md:hidden" onClick={onClose} aria-label="Close history" />
    </div>
  );
}
