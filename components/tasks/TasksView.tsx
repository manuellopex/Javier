'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/layout/Header';
import { formatDueDate } from '@/lib/utils';
import type { Task } from '@/types';

type Filter = 'pending' | 'completed' | 'all';

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(f: Filter) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?status=${f}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();
    if (res.ok) {
      setTasks((prev) => [data.task, ...prev]);
    } else {
      setError(data.error ?? 'Could not create task');
    }
  }

  async function toggleComplete(task: Task) {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) load(filter);
  }

  async function deleteTask(task: Task) {
    if (!confirm(`Delete "${task.title}" permanently?`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== task.id));
  }

  const visible =
    filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <>
      <Header title="Tasks" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <form onSubmit={createTask} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New task…"
              className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-xl bg-aura-accent px-4 py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          <div className="flex gap-1.5">
            {(['pending', 'completed', 'all'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                  filter === f
                    ? 'bg-aura-accent/15 font-medium text-aura-accent'
                    : 'text-aura-muted hover:bg-aura-raised'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-aura-danger">{error}</p>}

          {loading ? (
            <p className="py-8 text-center text-sm text-aura-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-aura-muted">
              {filter === 'pending' ? 'Nada pendiente. Limpio.' : 'No tasks here.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((task) => {
                const due = formatDueDate(task.due_at);
                const done = task.status === 'completed';
                return (
                  <li key={task.id} className="glass group flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleComplete(task)}
                      aria-label={done ? 'Mark as pending' : 'Mark as completed'}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        done
                          ? 'border-aura-accent bg-aura-accent text-aura-bg'
                          : 'border-aura-border hover:border-aura-accent'
                      }`}
                    >
                      {done && <span className="text-[10px]">✓</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${done ? 'text-aura-muted line-through' : ''}`}>
                        {task.title}
                      </p>
                      {task.notes && (
                        <p className="truncate text-xs text-aura-muted">{task.notes}</p>
                      )}
                    </div>
                    {due.label && !done && (
                      <span
                        className={`shrink-0 text-xs ${due.overdue ? 'text-aura-danger' : 'text-aura-muted'}`}
                      >
                        {due.label}
                      </span>
                    )}
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        task.priority === 'high'
                          ? 'bg-aura-danger'
                          : task.priority === 'medium'
                            ? 'bg-aura-warn'
                            : 'bg-aura-muted'
                      }`}
                      title={`Priority: ${task.priority}`}
                    />
                    <button
                      onClick={() => deleteTask(task)}
                      aria-label="Delete task"
                      className="hidden shrink-0 text-xs text-aura-muted transition hover:text-aura-danger group-hover:block"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
