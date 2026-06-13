import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { createClient, getUser, isSupabaseConfigured } from '@/lib/supabase/server';
import { formatDueDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect('/login');
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = createClient();

  const [tasksRes, commandsRes, conversationsRes, memoriesRes, eventsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, priority, due_at, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from('commands')
      .select('id, description, risk, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('conversations')
      .select('id, title, updated_at, source')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('events')
      .select('id, title, starts_at, all_day')
      .eq('user_id', user.id)
      .gte('starts_at', new Date().toISOString())
      .lte('starts_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(5),
  ]);

  const tasks = tasksRes.data ?? [];
  const pendingCommands = commandsRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  const memoryCount = memoriesRes.count ?? 0;
  // Local events only on the dashboard (fast, no external call);
  // /calendar shows the merged view including Google.
  const upcomingEvents = eventsRes.data ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <Header
        title="Dashboard"
        status={pendingCommands.length > 0 ? 'action_required' : 'online'}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{greeting}.</h2>
            <p className="mt-1 text-sm text-aura-muted">
              {tasks.length} tareas pendientes · {memoryCount} memorias ·{' '}
              {pendingCommands.length} acciones por confirmar
            </p>
          </div>

          {pendingCommands.length > 0 && (
            <section className="glass-raised border-aura-warn/30 p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aura-warn">
                ⏸ Action required
              </h3>
              <ul className="space-y-2">
                {pendingCommands.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{c.description}</span>
                    <Link href="/commands" className="shrink-0 text-xs text-aura-warn underline">
                      Review →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick chat */}
            <Link
              href="/chat"
              className="glass group flex items-center gap-4 p-5 transition hover:border-aura-accent/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-aura-accent/30 bg-aura-bg transition group-hover:shadow-[0_0_24px_rgba(57,210,192,0.25)]">
                <div className="h-4 w-4 rounded-full bg-aura-accent animate-breathe" />
              </div>
              <div>
                <p className="font-medium">Talk to AURA</p>
                <p className="text-xs text-aura-muted">Texto o voz · streaming en vivo</p>
              </div>
            </Link>

            {/* Memory summary */}
            <Link
              href="/memory"
              className="glass group flex items-center gap-4 p-5 transition hover:border-aura-accent/40"
            >
              <span className="text-2xl" aria-hidden>
                ◈
              </span>
              <div>
                <p className="font-medium">{memoryCount} memorias guardadas</p>
                <p className="text-xs text-aura-muted">Contexto que AURA usa al responder</p>
              </div>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Tasks */}
            <section className="glass p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
                  Next tasks
                </h3>
                <Link href="/tasks" className="text-xs text-aura-accent">
                  View all →
                </Link>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-aura-muted">Sin pendientes. Limpio.</p>
              ) : (
                <ul className="space-y-2.5">
                  {tasks.map((t) => {
                    const due = formatDueDate(t.due_at);
                    return (
                      <li key={t.id} className="flex items-center gap-3 text-sm">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            t.priority === 'high'
                              ? 'bg-aura-danger'
                              : t.priority === 'medium'
                                ? 'bg-aura-warn'
                                : 'bg-aura-muted'
                          }`}
                        />
                        <span className="flex-1 truncate">{t.title}</span>
                        {due.label && (
                          <span
                            className={`shrink-0 text-xs ${due.overdue ? 'text-aura-danger' : 'text-aura-muted'}`}
                          >
                            {due.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Upcoming events */}
            <section className="glass p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
                  This week
                </h3>
                <Link href="/calendar" className="text-xs text-aura-accent">
                  Calendar →
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-aura-muted">Sin eventos próximos.</p>
              ) : (
                <ul className="space-y-2.5">
                  {upcomingEvents.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 font-mono text-xs text-aura-accent">
                        {ev.all_day
                          ? new Date(ev.starts_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                            })
                          : new Date(ev.starts_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                      <span className="truncate">{ev.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent conversations */}
            <section className="glass p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
                  Recent conversations
                </h3>
                <Link href="/chat" className="text-xs text-aura-accent">
                  Open chat →
                </Link>
              </div>
              {conversations.length === 0 ? (
                <p className="text-sm text-aura-muted">Aún no hay conversaciones.</p>
              ) : (
                <ul className="space-y-2.5">
                  {conversations.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 truncate text-sm">
                      <span className="text-aura-muted" aria-hidden>
                        {c.source === 'shortcut' ? '⌘' : '◍'}
                      </span>
                      <span className="truncate">{c.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
