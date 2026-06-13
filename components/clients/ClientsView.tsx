'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Header } from '@/components/layout/Header';
import { renderMarkdown, formatDate } from '@/lib/utils';
import type { Client, Quote, ClientStatus, QuoteStatus } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  lead: 'border-aura-warn/40 text-aura-warn',
  active: 'border-aura-accent/40 text-aura-accent',
  archived: 'border-aura-muted/40 text-aura-muted',
  draft: 'border-aura-muted/40 text-aura-muted',
  sent: 'border-aura-warn/40 text-aura-warn',
  accepted: 'border-aura-accent/40 text-aura-accent',
  rejected: 'border-aura-danger/40 text-aura-danger',
};

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [clientsRes, quotesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/quotes'),
      ]);
      const clientsData = await clientsRes.json();
      const quotesData = await quotesRes.json();
      if (!clientsRes.ok) throw new Error(clientsData.error);
      setClients(clientsData.clients ?? []);
      setQuotes(quotesData.quotes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createClient(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), company: company.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setClients((prev) =>
        [...prev, data.client].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName('');
      setCompany('');
    } else {
      setError(data.error ?? 'Could not create client');
    }
  }

  async function setClientStatus(client: Client, status: ClientStatus) {
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status } : c)));
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteClient(client: Client) {
    if (!confirm(`Delete "${client.name}" and all their quotes permanently?`)) return;
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      setQuotes((prev) => prev.filter((q) => q.client_id !== client.id));
    }
  }

  async function setQuoteStatus(quote: Quote, status: QuoteStatus) {
    setQuotes((prev) => prev.map((q) => (q.id === quote.id ? { ...q, status } : q)));
    await fetch(`/api/quotes/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <>
      <Header title="Clients" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-xs text-aura-muted">
            CRM ligero. Las cotizaciones las genera AURA desde el chat («crea una cotización para
            X») y aquí las revisas y cambias de estado.
          </p>

          <form onSubmit={createClient} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name…"
              className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company (optional)"
              className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-xl bg-aura-accent px-4 py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {error && <p className="text-xs text-aura-danger">{error}</p>}
          {loading && <p className="py-8 text-center text-sm text-aura-muted">Loading…</p>}

          {!loading && clients.length === 0 && (
            <p className="py-8 text-center text-sm text-aura-muted">
              Sin clientes aún. Agrégalos aquí o desde el chat.
            </p>
          )}

          <ul className="space-y-2">
            {clients.map((client) => {
              const clientQuotes = quotes.filter((q) => q.client_id === client.id);
              const open = expanded === client.id;
              return (
                <li key={client.id} className="glass overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : client.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{client.name}</p>
                      <p className="truncate text-xs text-aura-muted">
                        {[client.company, client.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    {clientQuotes.length > 0 && (
                      <span className="shrink-0 text-[10px] text-aura-muted">
                        {clientQuotes.length} quote{clientQuotes.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[client.status]}`}
                    >
                      {client.status}
                    </span>
                    <span className="shrink-0 text-xs text-aura-muted">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="border-t border-aura-border px-4 py-3">
                      {client.notes && (
                        <p className="mb-3 text-xs text-aura-muted">{client.notes}</p>
                      )}
                      <div className="mb-3 flex items-center gap-2">
                        <select
                          value={client.status}
                          onChange={(e) =>
                            setClientStatus(client, e.target.value as ClientStatus)
                          }
                          className="rounded-lg border border-aura-border bg-aura-surface px-2 py-1 text-xs outline-none"
                        >
                          <option value="lead">Lead</option>
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                        <button
                          onClick={() => deleteClient(client)}
                          className="rounded-lg border border-aura-border px-2 py-1 text-xs text-aura-muted transition hover:text-aura-danger"
                        >
                          Delete
                        </button>
                      </div>

                      {clientQuotes.length === 0 ? (
                        <p className="text-xs text-aura-muted">
                          Sin cotizaciones. Pídesela a AURA en el chat.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {clientQuotes.map((quote) => (
                            <li key={quote.id} className="rounded-xl border border-aura-border p-3">
                              <details>
                                <summary className="flex cursor-pointer list-none items-center gap-2">
                                  <span className="min-w-0 flex-1 truncate text-sm">
                                    {quote.title}
                                  </span>
                                  {quote.amount != null && (
                                    <span className="shrink-0 font-mono text-xs text-aura-accent">
                                      {quote.amount.toLocaleString()} {quote.currency}
                                    </span>
                                  )}
                                  <select
                                    value={quote.status}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      setQuoteStatus(quote, e.target.value as QuoteStatus)
                                    }
                                    className={`shrink-0 rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-medium uppercase outline-none ${STATUS_STYLES[quote.status]}`}
                                  >
                                    <option value="draft">Draft</option>
                                    <option value="sent">Sent</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </summary>
                                <div
                                  className="prose-aura mt-3 border-t border-aura-border pt-3 text-sm"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMarkdown(quote.content),
                                  }}
                                />
                                <p className="mt-2 text-[10px] text-aura-muted">
                                  {formatDate(quote.created_at)}
                                </p>
                              </details>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
