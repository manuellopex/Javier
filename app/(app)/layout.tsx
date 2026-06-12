import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <div className="flex h-full flex-1 flex-col overflow-hidden pb-14 md:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
