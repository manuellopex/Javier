'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { formatDate } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const STALE_DAYS = 7;

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'border-aura-muted/40 text-aura-muted',
  contacted: 'border-aura-warn/40 text-aura-warn',
  qualified: 'border-aura-warn/40 text-aura-warn',
  proposal: 'border-aura-accent/40 text-aura-accent',
  won: 'border-aura-accent/60 text-aura-accent',
  lost: 'border-aura-danger/40 text-aura-danger',
};

export function SalesDeskView() {
  return (
    <Workspace
      title="Sales Desk"
      agentId="sales"
      agentName="Sales"
      suggestions={[
        '¿Qué leads llevan más de una semana sin seguimiento?',
        'Redacta el follow-up para los leads en propuesta',
        'Crea una cotización de paquete mensual de reels',
      ]}
    >
      {(refreshKey) => <SalesData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function isStale(lead: Lead): boolean {
  if (['won', 'lost', 'new'].includes(lead.status)) return false;
  const last = lead.last_contact_at ?? lead.updated_at;
  return Date.now() - new Date(last).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function SalesData({ refreshKey }: { refreshKey: number }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));
  }, [refreshKey]);

  async function addLead(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), contact: contact.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeads((prev) => [data.lead, ...prev]);
      setName('');
      setContact('');
    } else setError(data.error ?? 'Could not create lead');
  }

  async function setStatus(lead: Lead, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, touched: status === 'contacted' || status === 'proposal' }),
    });
  }

  async function markTouched(lead: Lead) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id ? { ...l, last_contact_at: new Date().toISOString() } : l
      )
    );
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ touched: true }),
    });
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`Delete lead "${lead.name}" permanently?`)) return;
    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
    if (res.ok) setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  const active = leads.filter((l) => !['won', 'lost'].includes(l.status));
  const pipelineValue = active.reduce((sum, l) => sum + (l.value_estimate ?? 0), 0);
  const staleLeads = leads.filter(isStale);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Pipeline summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass p-3 text-center">
          <p className="text-lg font-semibold">{active.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-aura-muted">Activos</p>
        </div>
        <div className="glass p-3 text-center">
          <p className="text-lg font-semibold text-aura-accent">
            ${pipelineValue.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-aura-muted">Pipeline</p>
        </div>
        <div className="glass p-3 text-center">
          <p className={`text-lg font-semibold ${staleLeads.length ? 'text-aura-warn' : ''}`}>
            {staleLeads.length}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-aura-muted">Sin seguimiento</p>
        </div>
      </div>

      <form onSubmit={addLead} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lead name…"
          className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email / IG / phone"
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

      {leads.length === 0 ? (
        <p className="glass px-4 py-3 text-xs text-aura-muted">
          Pipeline vacío. Agrega leads aquí o dile al agente: «nuevo lead: Juan de @fitlife,
          interesado en 4 reels mensuales».
        </p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => {
            const stale = isStale(lead);
            return (
              <li
                key={lead.id}
                className={`glass group flex items-center gap-3 px-4 py-3 ${
                  stale ? 'border-aura-warn/40' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {lead.name}
                    {stale && (
                      <span className="ml-2 text-[10px] font-medium text-aura-warn">
                        ⚠ {STALE_DAYS}d+ sin contacto
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-aura-muted">
                    {[lead.contact, lead.source, lead.segment, lead.interest]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {lead.value_estimate != null && (
                  <span className="shrink-0 font-mono text-xs text-aura-accent">
                    ${lead.value_estimate.toLocaleString()}
                  </span>
                )}
                <span className="hidden shrink-0 text-[10px] text-aura-muted sm:block">
                  {lead.last_contact_at ? formatDate(lead.last_contact_at) : 'nunca'}
                </span>
                <button
                  onClick={() => markTouched(lead)}
                  title="Marcar contacto hoy"
                  className="hidden shrink-0 rounded-lg border border-aura-border px-2 py-1 text-[10px] text-aura-muted transition hover:border-aura-accent/50 hover:text-aura-accent group-hover:block"
                >
                  ✓ contacto
                </button>
                <select
                  value={lead.status}
                  onChange={(e) => setStatus(lead, e.target.value as LeadStatus)}
                  className={`shrink-0 rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-medium uppercase outline-none ${STATUS_STYLES[lead.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteLead(lead)}
                  aria-label="Delete lead"
                  className="hidden shrink-0 text-xs text-aura-muted hover:text-aura-danger group-hover:block"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
