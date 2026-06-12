export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '◧' },
      { href: '/chat', label: 'Chat', icon: '◍' },
      { href: '/brief', label: 'Daily Brief', icon: '☀' },
      { href: '/agents', label: 'Agents', icon: '⬢' },
    ],
  },
  {
    label: 'Workspaces',
    items: [
      { href: '/content', label: 'Content Lab', icon: '▶' },
      { href: '/youtube', label: 'YouTube Research', icon: '◉' },
      { href: '/music', label: 'Music Finder', icon: '♫' },
      { href: '/sales', label: 'Sales Desk', icon: '◆' },
      { href: '/production', label: 'Production Hub', icon: '▣' },
      { href: '/ttp', label: 'TTP Growth', icon: '✦' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/tasks', label: 'Tasks', icon: '☰' },
      { href: '/calendar', label: 'Calendar', icon: '◷' },
      { href: '/clients', label: 'Clients', icon: '◎' },
      { href: '/memory', label: 'Memory', icon: '◈' },
      { href: '/commands', label: 'Approvals', icon: '⌘' },
      { href: '/integrations', label: 'Integrations', icon: '⬡' },
      { href: '/settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Subset shown in the mobile bottom navigation. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: '◧' },
  { href: '/chat', label: 'Chat', icon: '◍' },
  { href: '/brief', label: 'Brief', icon: '☀' },
  { href: '/agents', label: 'Agents', icon: '⬢' },
  { href: '/commands', label: 'Approvals', icon: '⌘' },
];
