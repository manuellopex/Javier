'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-aura-accent/30 bg-aura-surface shadow-[0_0_40px_rgba(57,210,192,0.15)]">
            <div className="h-6 w-6 rounded-full bg-aura-accent animate-breathe" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">AURA</h1>
          <p className="mt-1 text-sm text-aura-muted">Personal Command Center</p>
        </div>

        {!configured ? (
          <div className="glass p-5 text-sm text-aura-muted">
            <p className="mb-2 font-medium text-aura-warn">Setup required</p>
            <p>
              Supabase is not configured. Copy <code className="text-aura-accent">.env.example</code>{' '}
              to <code className="text-aura-accent">.env.local</code>, fill in your Supabase keys and
              restart. See <code className="text-aura-accent">docs/supabase-setup.md</code>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass space-y-4 p-6">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-aura-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-aura-border bg-aura-bg px-3 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-aura-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-aura-border bg-aura-bg px-3 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
              />
            </div>
            {error && <p className="text-sm text-aura-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-aura-accent py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-center text-xs text-aura-muted">
              Private system. Account creation is managed in Supabase.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
