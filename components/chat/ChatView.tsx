'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MessageBubble } from './MessageBubble';
import { MicButton } from './MicButton';
import { PendingCommandCard } from './PendingCommandCard';
import { ConversationList } from './ConversationList';
import { useSpeech, speak } from '@/hooks/useSpeech';
import type { AssistantStatus, ChatStreamEvent, Command, ToolCallRecord } from '@/types';

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[] | null;
  streaming?: boolean;
}

type PendingCmd = Pick<Command, 'id' | 'action' | 'description' | 'risk'>;

export function ChatView() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AssistantStatus>('online');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCmd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const ttsEnabled =
    typeof window !== 'undefined' && localStorage.getItem('aura:tts') === 'on';

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
      setStatus('thinking');

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
          body: JSON.stringify({ message: trimmed, conversationId }),
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
                          { name: event.name, input: {}, risk: event.risk, status: event.status },
                        ],
                      }
                    : m
                )
              );
              break;
            case 'command_pending':
              setPendingCommands((prev) => [...prev, event.command]);
              setStatus('action_required');
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
        if (ttsEnabled && fullText) speak(fullText);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content));
      } finally {
        busyRef.current = false;
        setStatus((s) => (s === 'action_required' ? s : 'online'));
      }
    },
    [conversationId, ttsEnabled]
  );

  const { state: speechState, start: startListening, stop: stopListening } = useSpeech({
    onResult: (text) => sendMessage(text),
    onError: (msg) => setError(msg),
  });

  useEffect(() => {
    setStatus((s) => {
      if (speechState === 'listening') return 'listening';
      if (s === 'listening') return 'online';
      return s;
    });
  }, [speechState]);

  async function resolveCommand(commandId: string, approve: boolean) {
    const res = await fetch('/api/commands/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId, approve }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Could not resolve command');
      return;
    }
    setPendingCommands((prev) => {
      const next = prev.filter((c) => c.id !== commandId);
      if (next.length === 0) setStatus('online');
      return next;
    });
  }

  async function loadConversation(id: string) {
    setHistoryOpen(false);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Could not load conversation');
      return;
    }
    setConversationId(id);
    setPendingCommands([]);
    setMessages(
      (data.messages ?? [])
        .filter((m: UIMessage) => m.role !== ('system' as string))
        .map((m: { id: string; role: 'user' | 'assistant'; content: string; tool_calls: ToolCallRecord[] | null }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.tool_calls,
        }))
    );
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setPendingCommands([]);
    setError(null);
    setHistoryOpen(false);
    setStatus('online');
  }

  return (
    <>
      <Header title="Chat" status={status} />
      <div className="relative flex flex-1 overflow-hidden">
        {historyOpen && (
          <ConversationList
            activeId={conversationId}
            onSelect={loadConversation}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 md:px-6">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="rounded-lg px-2 py-1 text-xs text-aura-muted transition hover:bg-aura-raised hover:text-aura-text"
            >
              ☰ History
            </button>
            <button
              onClick={newConversation}
              className="rounded-lg px-2 py-1 text-xs text-aura-muted transition hover:bg-aura-raised hover:text-aura-text"
            >
              + New conversation
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4 md:px-6">
            {messages.length === 0 ? (
              <EmptyChat onSuggestion={sendMessage} />
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
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
            )}
          </div>

          {error && (
            <p className="mx-auto mb-2 max-w-3xl px-4 text-xs text-aura-danger md:px-6">{error}</p>
          )}

          {/* Composer */}
          <div className="border-t border-aura-border bg-aura-bg/60 px-4 py-3 backdrop-blur-md md:px-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="mx-auto flex max-w-3xl items-end gap-2"
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
                placeholder={status === 'listening' ? 'Listening…' : 'Message AURA…'}
                className="max-h-40 flex-1 resize-none rounded-2xl border border-aura-border bg-aura-surface px-4 py-3 text-sm outline-none transition focus:border-aura-accent/60"
              />
              <MicButton
                state={speechState}
                onStart={startListening}
                onStop={stopListening}
              />
              <button
                type="submit"
                disabled={!input.trim() || status === 'thinking'}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-aura-accent text-aura-bg transition hover:brightness-110 disabled:opacity-40"
                aria-label="Send"
              >
                ↑
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

const SUGGESTIONS = [
  'Organiza mi día',
  'Recuérdame llamar a Rob mañana a las 10',
  '¿Qué tareas tengo pendientes?',
  'Convierte esta idea en un plan: …',
];

function EmptyChat({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-aura-accent/20 bg-aura-surface shadow-[0_0_60px_rgba(57,210,192,0.12)]">
        <div className="h-8 w-8 rounded-full bg-aura-accent/80 animate-breathe" />
      </div>
      <div>
        <p className="text-lg font-medium">¿En qué trabajamos?</p>
        <p className="mt-1 text-sm text-aura-muted">
          Tareas, recordatorios, notas, planes — texto o voz.
        </p>
      </div>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="glass px-3 py-1.5 text-xs text-aura-muted transition hover:border-aura-accent/40 hover:text-aura-text"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
