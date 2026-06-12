'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';

interface Status {
  googleCalendar: { available: boolean; connected: boolean };
  email: { configured: boolean; provider: string | null };
  tts: { configured: boolean; provider: string | null };
  stt: { configured: boolean; provider: string | null };
  shortcuts: { configured: boolean };
  desktopAgent: {
    configured: boolean;
    connected: boolean;
    last_seen: string | null;
    hostname: string | null;
  };
}

function Badge({ on, labelOn, labelOff }: { on: boolean; labelOn: string; labelOff: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${
        on ? 'border-aura-accent/40 text-aura-accent' : 'border-aura-muted/40 text-aura-muted'
      }`}
    >
      {on ? labelOn : labelOff}
    </span>
  );
}

export function IntegrationsView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const googleResult = params.get('google');

  async function load() {
    const res = await fetch('/api/integrations/status');
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google Calendar? Stored tokens will be deleted.')) return;
    setBusy(true);
    try {
      await fetch('/api/integrations/google/disconnect', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Integrations" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {googleResult === 'connected' && (
            <p className="glass border-aura-accent/30 px-4 py-3 text-xs text-aura-accent">
              ✓ Google Calendar conectado. Tus eventos ya se mezclan en /calendar y en el chat.
            </p>
          )}
          {googleResult === 'error' && (
            <p className="glass border-aura-danger/30 px-4 py-3 text-xs text-aura-danger">
              No se pudo conectar Google Calendar. Revisa GOOGLE_CLIENT_ID/SECRET y la redirect
              URI (docs/integrations.md), e inténtalo de nuevo.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {/* Google Calendar */}
            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Google Calendar</p>
                <Badge
                  on={Boolean(status?.googleCalendar.connected)}
                  labelOn="connected"
                  labelOff={status?.googleCalendar.available ? 'not connected' : 'needs setup'}
                />
              </div>
              <p className="mb-3 text-xs leading-relaxed text-aura-muted">
                Lee y crea eventos en tu calendario real. Lectura directa; borrar siempre pide
                confirmación.
              </p>
              {status?.googleCalendar.connected ? (
                <button
                  onClick={disconnectGoogle}
                  disabled={busy}
                  className="rounded-lg border border-aura-border px-3 py-1.5 text-xs text-aura-muted transition hover:text-aura-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : status?.googleCalendar.available ? (
                <a
                  href="/api/integrations/google/connect"
                  className="inline-block rounded-lg bg-aura-accent px-3 py-1.5 text-xs font-semibold text-aura-bg transition hover:brightness-110"
                >
                  Connect Google Calendar
                </a>
              ) : (
                <p className="text-[10px] text-aura-muted">
                  Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET — ver docs/integrations.md.
                  Mientras tanto, el calendario local funciona solo.
                </p>
              )}
            </div>

            {/* Email */}
            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Email</p>
                <Badge
                  on={Boolean(status?.email.configured)}
                  labelOn={status?.email.provider ?? 'on'}
                  labelOff="needs setup"
                />
              </div>
              <p className="text-xs leading-relaxed text-aura-muted">
                AURA redacta borradores libremente; <strong className="text-aura-text">enviar</strong>{' '}
                siempre crea un comando HIGH que confirmas en Commands.{' '}
                {!status?.email.configured &&
                  'Configura RESEND_API_KEY y EMAIL_FROM (docs/integrations.md).'}
              </p>
            </div>

            {/* Apple Shortcuts */}
            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Apple Shortcuts</p>
                <Badge
                  on={Boolean(status?.shortcuts.configured)}
                  labelOn="ready"
                  labelOff="needs setup"
                />
              </div>
              <p className="text-xs leading-relaxed text-aura-muted">
                Siri / botón de acción / widget → AURA. Guía: docs/apple-shortcuts.md.
              </p>
            </div>

            {/* Voice */}
            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Voice (STT/TTS)</p>
                <Badge
                  on={Boolean(status?.tts.configured || status?.stt.configured)}
                  labelOn="premium"
                  labelOff="browser"
                />
              </div>
              <p className="text-xs leading-relaxed text-aura-muted">
                Transcripción: {status?.stt.provider ?? 'navegador'} · Voz:{' '}
                {status?.tts.provider ?? 'navegador'}. Configuración: docs/voice.md.
              </p>
            </div>

            {/* Desktop Agent */}
            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Desktop Agent</p>
                <Badge
                  on={Boolean(status?.desktopAgent.connected)}
                  labelOn={`online · ${status?.desktopAgent.hostname ?? 'agent'}`}
                  labelOff={status?.desktopAgent.configured ? 'offline' : 'needs setup'}
                />
              </div>
              <p className="text-xs leading-relaxed text-aura-muted">
                Acciones en tu Mac/PC con allowlist local. El asistente las solicita (HIGH), tú
                las apruebas en Approvals, y el agente las ejecuta vía polling saliente — sin
                puertos abiertos.{' '}
                {!status?.desktopAgent.configured
                  ? 'Configura DESKTOP_AGENT_KEY en el servidor y el bloque "backend" en desktop-agent/config.json.'
                  : !status?.desktopAgent.connected
                    ? 'El agente no reporta — arráncalo con npm start en desktop-agent/.'
                    : 'Conectado.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
