'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/client';

export function SettingsView() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [tts, setTts] = useState(false);
  const [lang, setLang] = useState('es-MX');

  useEffect(() => {
    setTts(localStorage.getItem('aura:tts') === 'on');
    setLang(localStorage.getItem('aura:lang') ?? 'es-MX');
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  function toggleTts() {
    const next = !tts;
    setTts(next);
    localStorage.setItem('aura:tts', next ? 'on' : 'off');
  }

  function changeLang(value: string) {
    setLang(value);
    localStorage.setItem('aura:lang', value);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <Header title="Settings" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <section className="glass p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Account
            </h3>
            <div className="flex items-center justify-between">
              <p className="text-sm">{email ?? '—'}</p>
              <button
                onClick={signOut}
                className="rounded-lg border border-aura-border px-3 py-1.5 text-xs text-aura-muted transition hover:bg-aura-raised hover:text-aura-text"
              >
                Sign out
              </button>
            </div>
          </section>

          <section className="glass p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Voice
            </h3>
            <div className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm">Read responses aloud</p>
                <p className="text-xs text-aura-muted">Browser text-to-speech for replies</p>
              </div>
              <button
                role="switch"
                aria-checked={tts}
                onClick={toggleTts}
                className={`relative h-6 w-11 rounded-full transition ${tts ? 'bg-aura-accent' : 'bg-aura-border'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${tts ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm">Speech language</p>
                <p className="text-xs text-aura-muted">For voice input and TTS</p>
              </div>
              <select
                value={lang}
                onChange={(e) => changeLang(e.target.value)}
                className="rounded-lg border border-aura-border bg-aura-surface px-3 py-1.5 text-xs outline-none"
              >
                <option value="es-MX">Español (MX)</option>
                <option value="es-ES">Español (ES)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </section>

          <section className="glass p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Install as app
            </h3>
            <ul className="space-y-2 text-xs leading-relaxed text-aura-muted">
              <li>
                <strong className="text-aura-text">iPhone/iPad:</strong> Safari → Compartir →
                &ldquo;Agregar a pantalla de inicio&rdquo;.
              </li>
              <li>
                <strong className="text-aura-text">Mac/desktop:</strong> Chrome/Edge → icono de
                instalación en la barra de direcciones.
              </li>
            </ul>
          </section>

          <section className="glass p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Apple Shortcuts
            </h3>
            <p className="text-xs leading-relaxed text-aura-muted">
              Endpoint: <code className="text-aura-accent">/api/shortcut/command</code> con tu API
              key personal. Guía paso a paso en{' '}
              <code className="text-aura-accent">docs/apple-shortcuts.md</code>.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
