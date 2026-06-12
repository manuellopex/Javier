'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PendingCommandCard } from '@/components/chat/PendingCommandCard';
import type { UIMessage } from '@/components/chat/ChatView';
import type { ChatStreamEvent, Command, ToolCallRecord } from '@/types';

type PendingCmd = Pick<Command, 'id' | 'action' | 'description' | 'risk'>;

/**
 * Embedded agent chat used inside every workspace (Content Lab, Sales Desk…).
 * Same /api/chat engine and approval flow as the main chat; no voice — the
 * full experience lives in /chat.
 */
export function AgentChat({
  agentId,
  placeholder = 'Mensaje al agente…',
  suggestions = [],
  onActivity,
}: {
  agentId: string;
  placeholder?: string;
  suggestions?: string[];
  /** Called after each completed turn — workspaces refresh their data panels. */
  onActivity?: () => void;
}) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCmd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingCommands]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setInput('');
      setThinking(true);

      const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
      const assistantMsg: UIMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
        streaming: true,
        toolCalls: [],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, conversationId, agentId }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        const handleEvent = (event: ChatStreamEvent) => {
          switch (event.type) {
            case 'conversation':
              setConversationId(event.conversationId);
              break;
            case 'delta':
              fullText += event.text;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullText } : m))
              );
              break;
            case 'tool':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          {
                            name: event.name,
                            input: {},
                            risk: event.risk,
                            status: event.status,
                          } as ToolCallRecord,
                        ],
                      }
                    : m
                )
              );
              break;
            case 'command_pending':
              setPendingCommands((prev) => [...prev, event.command]);
              break;
            case 'error':
              setError(event.message);
              break;
            case 'done':
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              handleEvent(JSON.parse(line.slice(6)) as ChatStreamEvent);
            } catch {
              // skip malformed frame
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content));
      } finally {
        busyRef.current = false;
        setThinking(false);
        onActivity?.();
      }
    },
    [agentId, conversationId, onActivity]
  );

  async function resolveCommand(commandId: string, approve: boolean) {
    const res = await fetch('/api/commands/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId, approve }),
    });
    if (res.ok) {
      setPendingCommands((prev) => prev.filter((c) => c.id !== commandId));
      onActivity?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not resolve command');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="glass px-3 py-1.5 text-left text-xs text-aura-muted transition hover:border-aura-accent/40 hover:text-aura-text"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pendingCommands.map((cmd) => (
          <PendingCommandCard
            key={cmd.id}
            command={cmd}
            onResolve={(approve) => resolveCommand(cmd.id, approve)}
          />
        ))}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-aura-danger">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-end gap-2 border-t border-aura-border p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-32 flex-1 resize-none rounded-xl border border-aura-border bg-aura-surface px-3 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-accent text-aura-bg transition hover:brightness-110 disabled:opacity-40"
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
