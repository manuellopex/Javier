import { Suspense } from 'react';
import { IntegrationsView } from '@/components/integrations/IntegrationsView';

export const dynamic = 'force-dynamic';

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsView />
    </Suspense>
  );
}
