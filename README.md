# AURA Command Center

Asistente personal privado estilo *mission control*: PWA oscura y minimalista con chat en streaming, comandos por voz, tareas, memoria controlada por el usuario, sistema de permisos por nivel de riesgo, endpoint para Apple Shortcuts y un desktop agent local opcional.

> Inspirado en la idea de un asistente tipo JARVIS, pero 100% original: sin marcas, voces ni assets de terceros.

## Qué incluye el MVP

- **Chat con AURA** — streaming SSE, herramientas (tareas/memoria) ejecutadas por el modelo, historial de conversaciones.
- **Voz (Fase 2 incluida)** — entrada por Web Speech API (Safari/Chrome, incluido iPhone) con fallback a grabación + transcripción server-side (Deepgram o Groq Whisper vía env vars); respuestas habladas con ElevenLabs (fallback automático al TTS del navegador); **modo manos libres** con auto-envío y orbe reactivo al micrófono. Detalles: [docs/voice.md](./docs/voice.md).
- **Tareas** — crear (UI o chat), listar, completar, borrar; prioridades y fechas.
- **Memoria** — AURA guarda contexto útil; tú lo ves, agregas y borras. Se inyecta en cada conversación.
- **Sistema de permisos** — riesgo LOW/MEDIUM/HIGH/CRITICAL; las acciones HIGH/CRITICAL crean comandos pendientes que **tú confirmas** en la UI. Todo auditado en `security_logs`.
- **Apple Shortcuts** — `POST /api/shortcut/command` con API key personal: Siri → dictado → respuesta hablada.
- **PWA** — instalable en iPhone, iPad, Mac y desktop; dark mode, sidebar en desktop, bottom nav en mobile.
- **Desktop Agent** (opcional) — microservicio local con allowlist estricta y logs ([desktop-agent/](./desktop-agent/)).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Base de datos + Auth | Supabase (Postgres con RLS) |
| IA | Capa `LLMProvider` abstracta → Anthropic Claude (`claude-opus-4-8`) con streaming y tool use |
| Hosting | Vercel |
| Desktop agent | Node.js sin dependencias |

## Instalación

```bash
git clone <este-repo> && cd <repo>
npm install
cp .env.example .env.local
```

1. **Supabase**: crea el proyecto, ejecuta [`db/schema.sql`](./db/schema.sql), crea tu usuario y copia las llaves → [docs/supabase-setup.md](./docs/supabase-setup.md).
2. **Anthropic**: pon tu `ANTHROPIC_API_KEY` (de [console.anthropic.com](https://console.anthropic.com)).
3. **Tu email**: `ALLOWED_EMAIL` — nadie más puede entrar, ni con cuenta válida.
4. Arranca:

```bash
npm run dev   # http://localhost:3000
```

## Desplegar en Vercel

Guía completa: [docs/deployment.md](./docs/deployment.md). En corto: importa el repo, pega las variables de `.env.example`, deploy, e instala la PWA desde Safari/Chrome.

## Apple Shortcuts

Guía paso a paso con payload de ejemplo: [docs/apple-shortcuts.md](./docs/apple-shortcuts.md).

## Estructura

```
app/              páginas (App Router) + API route handlers
components/       UI (layout, chat, tasks, memory, commands, settings)
hooks/            useSpeech (voz: Web Speech API + fallback)
lib/
  ai/             LLMProvider abstracto, proveedor Anthropic, tools, system prompt
  security/       niveles de riesgo, rate limiting, audit log
  supabase/       clientes browser / server / admin (service role)
services/         assistant (loop agéntico + permisos), stt (interfaz)
db/schema.sql     esquema completo con RLS
types/            tipos de dominio compartidos
public/           manifest PWA, service worker, iconos
docs/             arquitectura, despliegue, Supabase, Shortcuts, roadmap
desktop-agent/    microservicio local opcional
```

## Seguridad (resumen)

- Ninguna API key vive en el frontend; todo por variables de entorno.
- RLS en todas las tablas + lock global por `ALLOWED_EMAIL` en el middleware.
- Acciones del asistente clasificadas por riesgo; HIGH/CRITICAL **nunca** se ejecutan sin confirmación manual (`/api/commands/confirm` es el único ejecutor).
- Rate limiting básico por usuario/IP en todos los endpoints de escritura.
- Logs de auditoría append-only (`security_logs`), incluidos intentos fallidos de auth del Shortcut.
- API key de Shortcuts comparada en tiempo constante.

## Supuestos del MVP (documentados)

1. **Usuario único**: el registro está deshabilitado; el sistema asume un solo dueño (`ALLOWED_EMAIL`).
2. **`complete_task` ejecuta directo** (MEDIUM): es reversible y casi siempre orden explícita. Borrar — tanto tareas como memorias — sí exige confirmación cuando lo inicia el asistente.
3. **Acciones desde la propia UI** (botón ✕ de borrar) no pasan por la cola de comandos: el clic del usuario es la confirmación. La cola protege contra acciones *iniciadas por el asistente*.
4. **STT del servidor** queda como interfaz preparada sin proveedor (la voz del MVP usa el navegador); `/api/transcribe` lo explica si se invoca.
5. **Rate limiting in-memory**: best-effort en serverless; el upgrade durable está en el roadmap.
6. **Calendario**: la vista y la integración real llegan en Fase 3; hoy las fechas viven en las tareas (`due_at`).

## Roadmap

Fases 2–6 (voz avanzada, calendario/email/CRM, desktop agent conectado, workflows, UI cinematográfica) en [docs/roadmap.md](./docs/roadmap.md).
