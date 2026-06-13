'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NAV_GROUPS } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-aura-border bg-aura-surface/50 backdrop-blur-md md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-aura-accent/30 bg-aura-bg">
          <div className="h-3 w-3 rounded-full bg-aura-accent animate-breathe" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">AURA</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-aura-muted">
            Command Center
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-widest text-aura-muted/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-aura-accent/10 font-medium text-aura-accent'
                        : 'text-aura-muted hover:bg-aura-raised hover:text-aura-text'
                    }`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-aura-border p-3">
        <button
          onClick={signOut}
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-aura-muted transition hover:bg-aura-raised hover:text-aura-text"
        >
          ← Sign out
        </button>
      </div>
    </aside>
  );
}
