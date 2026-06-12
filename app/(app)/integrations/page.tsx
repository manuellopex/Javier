import { Header } from '@/components/layout/Header';

export const dynamic = 'force-dynamic';

const INTEGRATIONS = [
  {
    name: 'Apple Shortcuts',
    status: 'available',
    description:
      'Habla con AURA desde Siri, el botón de acción o un widget. Configuración en docs/apple-shortcuts.md.',
  },
  {
    name: 'Desktop Agent',
    status: 'available',
    description:
      'Microservicio local opcional para acciones en tu Mac/PC (abrir apps, archivos) con allowlist. Ver carpeta desktop-agent/.',
  },
  {
    name: 'Calendar',
    status: 'planned',
    description: 'Lectura y escritura de calendario con confirmación. Fase 3.',
  },
  {
    name: 'Email',
    status: 'planned',
    description: 'Borradores automáticos; el envío siempre requiere confirmación. Fase 3.',
  },
  {
    name: 'CRM',
    status: 'planned',
    description: 'Clientes, cotizaciones y seguimiento. Fase 3.',
  },
  {
    name: 'STT/TTS externo',
    status: 'planned',
    description: 'Transcripción y voz de alta calidad (Deepgram / ElevenLabs). Fase 2.',
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <Header title="Integrations" />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{integration.name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${
                    integration.status === 'available'
                      ? 'border-aura-accent/40 text-aura-accent'
                      : 'border-aura-muted/40 text-aura-muted'
                  }`}
                >
                  {integration.status}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-aura-muted">{integration.description}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
