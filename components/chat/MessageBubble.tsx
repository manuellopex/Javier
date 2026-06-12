'use client';

import { renderMarkdown } from '@/lib/utils';
import type { UIMessage } from './ChatView';

const TOOL_LABELS: Record<string, string> = {
  create_task: 'Task created',
  list_tasks: 'Tasks checked',
  complete_task: 'Task completed',
  delete_task: 'Task deletion requested',
  save_memory: 'Memory saved',
  search_memory: 'Memory searched',
  list_memories: 'Memories listed',
  delete_memory: 'Memory deletion requested',
};

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[75%] ${
          isUser
            ? 'bg-aura-accent/15 text-aura-text'
            : 'glass text-aura-text'
        }`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  tc.status === 'pending_confirmation'
                    ? 'border-aura-warn/40 text-aura-warn'
                    : tc.status === 'error'
                      ? 'border-aura-danger/40 text-aura-danger'
                      : 'border-aura-accent/30 text-aura-accent'
                }`}
              >
                {tc.status === 'executed' ? '✓' : tc.status === 'pending_confirmation' ? '⏸' : '✕'}{' '}
                {TOOL_LABELS[tc.name] ?? tc.name}
              </span>
            ))}
          </div>
        )}

        {message.content ? (
          <div
            className="prose-aura"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        ) : message.streaming ? (
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-muted [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-muted [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-muted [animation-delay:300ms]" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
