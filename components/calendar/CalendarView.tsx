'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/layout/Header';
import type { CalendarEvent } from '@/types';

const RANGE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView() {
  const [rangeStart, setRangeStart] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');

  async function load(start: Date) {
    setLoading(true);
    setError(null);
    try {
      const from = start.toISOString();
      const to = new Date(start.getTime() + RANGE_DAYS * DAY_MS).toISOString();
      const res = await fetch(`/api/events?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(rangeStart);
  }, [rangeStart]);

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) return;
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), starts_at: new Date(when).toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not create event');
      return;
    }
    setTitle('');
    setWhen('');
    setShowForm(false);
    load(rangeStart);
  }

  async function deleteEvent(event: CalendarEvent) {
    if (!confirm(`Delete "${event.title}"${event.source === 'google' ? ' from Google Calendar' : ''}?`))
      return;
    const res = await fetch(`/api/events/${encodeURIComponent(event.id)}?source=${event.source}`, {
      method: 'DELETE',
    });
    if (res.ok) setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not delete event');
    }
  }

  // Group by day
  const days: { date: Date; items: CalendarEvent[] }[] = [];
  for (let i = 0; i < RANGE_DAYS; i++) {
    const date = new Date(rangeStart.getTime() + i * DAY_MS);
    const next = new Date(date.getTime() + DAY_MS);
    const items = events.filter((ev) => {
      const t = new Date(ev.starts_at).getTime();
      return t >= date.getTime() && t < next.getTime();
    });
    days.push({ date, items });
  }

  const rangeLabel = `${rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
    rangeStart.getTime() + (RANGE_DAYS - 1) * DAY_MS
  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <>
      <Header title="Calendar" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRangeStart(new Date(rangeStart.getTime() - RANGE_DAYS * DAY_MS))}
                className="rounded-lg border border-aura-border px-2.5 py-1.5 text-xs text-aura-muted transition hover:bg-aura-raised"
              >
                ←
              </button>
              <button
                onClick={() => setRangeStart(startOfDay(new Date()))}
                className="rounded-lg border border-aura-border px-3 py-1.5 text-xs text-aura-muted transition hover:bg-aura-raised"
              >
                Today
              </button>
              <button
                onClick={() => setRangeStart(new Date(rangeStart.getTime() + RANGE_DAYS * DAY_MS))}
                className="rounded-lg border border-aura-border px-2.5 py-1.5 text-xs text-aura-muted transition hover:bg-aura-raised"
              >
                →
              </button>
              <span className="ml-2 text-xs text-aura-muted">{rangeLabel}</span>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-aura-accent px-3 py-1.5 text-xs font-semibold text-aura-bg transition hover:brightness-110"
            >
              + Event
            </button>
          </div>

          {showForm && (
            <form onSubmit={createEvent} className="glass flex flex-col gap-2 p-4 sm:flex-row">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title…"
                className="flex-1 rounded-lg border border-aura-border bg-aura-bg px-3 py-2 text-sm outline-none focus:border-aura-accent/60"
              />
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-lg border border-aura-border bg-aura-bg px-3 py-2 text-sm outline-none focus:border-aura-accent/60"
              />
              <button
                type="submit"
                disabled={!title.trim() || !when}
                className="rounded-lg bg-aura-accent px-4 py-2 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
              >
                Add
              </button>
            </form>
          )}

          {error && <p className="text-xs text-aura-danger">{error}</p>}
          {loading && <p className="py-8 text-center text-sm text-aura-muted">Loading…</p>}

          {!loading && (
            <div className="space-y-3">
              {days.map(({ date, items }) => {
                const isToday = date.toDateString() === new Date().toDateString();
                if (items.length === 0 && !isToday) return null;
                return (
                  <section key={date.toISOString()}>
                    <h3
                      className={`mb-1.5 text-xs font-semibold uppercase tracking-wider ${
                        isToday ? 'text-aura-accent' : 'text-aura-muted'
                      }`}
                    >
                      {isToday
                        ? 'Today'
                        : date.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                    </h3>
                    {items.length === 0 ? (
                      <p className="px-1 text-xs text-aura-muted">Sin eventos.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((ev) => (
                          <li
                            key={`${ev.source}-${ev.id}`}
                            className="glass group flex items-center gap-3 px-4 py-2.5"
                          >
                            <span className="w-14 shrink-0 font-mono text-xs text-aura-accent">
                              {ev.all_day
                                ? 'All day'
                                : new Date(ev.starts_at).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{ev.title}</p>
                              {ev.location && (
                                <p className="truncate text-xs text-aura-muted">{ev.location}</p>
                              )}
                            </div>
                            {ev.source === 'google' && (
                              <span
                                className="shrink-0 rounded-full border border-aura-border px-1.5 py-0.5 text-[9px] font-semibold text-aura-muted"
                                title="Google Calendar"
                              >
                                G
                              </span>
                            )}
                            <button
                              onClick={() => deleteEvent(ev)}
                              aria-label="Delete event"
                              className="hidden shrink-0 text-xs text-aura-muted transition hover:text-aura-danger group-hover:block"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {events.length === 0 && (
                <p className="py-8 text-center text-sm text-aura-muted">
                  Sin eventos en este rango. Crea uno aquí o dile a AURA: «agenda una llamada el
                  viernes a las 3».
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
