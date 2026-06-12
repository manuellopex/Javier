export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◧' },
  { href: '/chat', label: 'Chat', icon: '◍' },
  { href: '/tasks', label: 'Tasks', icon: '☰' },
  { href: '/memory', label: 'Memory', icon: '◈' },
  { href: '/commands', label: 'Commands', icon: '⌘' },
  { href: '/integrations', label: 'Integrations', icon: '⬡' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
] as const;

/** Subset shown in the mobile bottom navigation. */
export const MOBILE_NAV = NAV_ITEMS.filter((i) =>
  ['/dashboard', '/chat', '/tasks', '/commands', '/settings'].includes(i.href)
);
