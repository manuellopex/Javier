# Sistema de agentes

AURA es un sistema de **agentes modulares** sobre un solo motor. Cada agente es una entrada en `lib/agents/registry.ts`:

| Campo | Qué define |
|---|---|
| `id`, `name`, `tagline`, `description`, `icon` | Identidad |
| `systemPrompt` | Especialización, método de trabajo y formato de output estructurado |
| `tools` | Subconjunto del registro de herramientas (`lib/ai/tools.ts`) |
| `canDo` / `needsApproval` | Qué hace solo vs. qué requiere tu confirmación (documentación visible en /agents) |
| `suggestions` | Chips de inicio rápido en su workspace |

**Lo que NO cambia entre agentes**: la matriz de riesgo (`lib/security/risk.ts`), la cola de aprobaciones (tabla `commands`), el log de auditoría (cada tool call registra qué agente lo hizo) y el loop agéntico con gating (`services/assistant.ts`). Un agente no puede saltarse el sistema de permisos porque el riesgo vive en la herramienta, no en el agente.

**Agregar un agente** = agregar una entrada al registry (y opcionalmente un workspace en `components/workspaces/`). Cero cambios en el motor.

## Los agentes

| Agente | Workspace | Herramientas clave | Requiere aprobación |
|---|---|---|---|
| **AURA** (orquestador) | /chat | todas | emails, borrados |
| **Content Growth** | /content | métricas, contenidos, youtube_search | publicar (futuro) |
| **YouTube Research** | /youtube | youtube_search, referencias, reportes | — |
| **Music Direction** | /music | spotify_search, playlists | — |
| **Sales** | /sales | leads, quotes, follow-ups, send_email | enviar emails |
| **Production Ops** | /production | proyectos, tareas por fase, shot lists/call sheets | borrar eventos |
| **TTP Growth** | /ttp | segmentos, emails, posts Discord, SOPs | enviar emails |
| **Daily Strategy** | /brief | lee todo (tasks/events/leads/projects/approvals) | — |

## Output estructurado

Los entregables de los agentes no viven solo en el chat: se guardan con `save_content` en la tabla `contents` (tipos: idea, hook, script, caption, thumbnail, calendar, report, reference, playlist, email, post, sop) y aparecen en el workspace correspondiente, donde los gestionas (estado draft/approved/published/archived, borrar).

## Configuración de APIs externas

### YouTube Data API (YouTube Research)
1. [Google Cloud Console](https://console.cloud.google.com) → tu proyecto (el mismo de Calendar sirve) → **Library** → habilita **YouTube Data API v3**.
2. **Credentials → Create credentials → API key** → `YOUTUBE_API_KEY`.
3. Cuota gratuita: 10,000 unidades/día (una búsqueda ≈ 100 unidades).

### Spotify Web API (Music Direction)
1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app** (redirect URI no importa para client-credentials).
2. Copia Client ID y Secret → `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.
3. Nota: búsqueda de catálogo público. Crear playlists reales en tu cuenta requiere OAuth de usuario (roadmap); mientras tanto las playlists de referencia viven en AURA.

### Instagram (Content Growth)
La Instagram Graph API requiere cuenta business + app review de Meta. **Mientras tanto las métricas son manuales**: en /content (+ Log metrics) o dictándoselas al agente («el reel de ayer hizo 80k views»). La tabla `content_metrics` es la misma que llenará la API cuando se conecte — el análisis de patrones funciona igual desde hoy.

### LaunchPass / Discord / Stripe (TTP Growth)
No conectadas aún. El agente opera sobre la tabla `leads` (source: webinar/ttp, campo `segment`) y drafts. Las integraciones alimentarán los mismos segmentos (roadmap).

## Reglas de independencia (recordatorio)

| Riesgo | Política | Ejemplos |
|---|---|---|
| LOW | Directo | analizar, buscar, listar, resumir |
| MEDIUM | Directo + audit log | crear tareas/leads/proyectos/drafts/reportes, registrar métricas |
| HIGH | **Aprobación manual siempre** | enviar emails, publicar, borrar, modificar calendario (delete), contactar clientes |
| CRITICAL | **Aprobación manual siempre** | pagos, credenciales, borrados masivos |
