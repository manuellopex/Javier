# Arquitectura — AURA Command Center

```
┌─────────────────────────────────────────────────────────────────────┐
│ Clientes                                                            │
│  iPhone (PWA/Safari, Siri Shortcut) · Desktop/Laptop (navegador)    │
└──────────────┬──────────────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────────────┐
│ Next.js (Vercel)                                                    │
│                                                                     │
│  UI (App Router, client components)                                 │
│   /dashboard /chat /tasks /memory /commands /integrations /settings │
│                                                                     │
│  middleware.ts — sesión Supabase + lock por ALLOWED_EMAIL           │
│                                                                     │
│  API Route Handlers                                                 │
│   /api/chat                SSE streaming + tool loop                │
│   /api/tasks[, /:id]       CRUD tareas                              │
│   /api/memory[, /:id]      CRUD memorias                            │
│   /api/conversations[/:id] historial                                │
│   /api/commands, /confirm  confirmación de acciones HIGH/CRITICAL   │
│   /api/shortcut/command    Apple Shortcuts (API key, service role)  │
│   /api/transcribe          fallback STT (proveedor enchufable)      │
│                                                                     │
│  lib/ai        — LLMProvider abstracto → AnthropicProvider          │
│  lib/security  — niveles de riesgo, rate limit, audit log           │
│  services/     — assistant (loop agéntico + gating), stt            │
└──────┬───────────────────────────────┬──────────────────────────────┘
       │                               │
┌──────▼─────────┐            ┌────────▼─────────┐
│ Supabase       │            │ Anthropic API    │
│ Postgres + RLS │            │ claude-opus-4-8  │
│ Auth           │            │ (streaming +     │
│ 7 tablas       │            │  tool use)       │
└────────────────┘            └──────────────────┘

┌─────────────────────────────┐
│ desktop-agent (opcional)    │  Node sin dependencias, solo localhost,
│ corre en tu Mac/PC          │  6 acciones allowlisted, log JSON.
└─────────────────────────────┘  Se conecta al backend en Fase 4.
```

## Flujo del chat (decisión central de diseño)

1. El cliente hace `POST /api/chat` y consume **Server-Sent Events**.
2. El servidor persiste el mensaje, carga historial + memorias, y corre un
   **loop agéntico manual** (`services/assistant.ts`): cada `tool_use` del
   modelo pasa por `executeTool()`, que consulta `lib/security/risk.ts`.
3. **LOW/MEDIUM** → se ejecuta, se audita, el resultado vuelve al modelo.
   **HIGH/CRITICAL** → NO se ejecuta: se inserta un `command` con estado
   `pending`, se emite el evento `command_pending` al cliente, y el modelo
   recibe como resultado "requiere confirmación".
4. El usuario aprueba/deniega en la UI → `POST /api/commands/confirm`, el
   único lugar del sistema que ejecuta acciones HIGH/CRITICAL.

El loop es manual (no el tool-runner del SDK) precisamente para que el
sistema de permisos pueda interceptar cada llamada.

## Matriz de riesgo

| Nivel | Ejemplos | Política |
|---|---|---|
| LOW | listar, buscar, resumir, redactar | Ejecuta directo |
| MEDIUM | crear tarea, completar tarea, guardar memoria | Ejecuta directo + audit log |
| HIGH | borrar tarea/memoria, enviar email, comando de escritorio | Comando pendiente + confirmación manual |
| CRITICAL | pagos, credenciales, borrado masivo | Comando pendiente + confirmación manual |

Supuesto documentado: `complete_task` es MEDIUM y ejecuta directo (es
reversible y normalmente es una orden explícita del usuario). Las acciones
de la propia UI (p. ej. borrar una tarea con el botón ✕) no pasan por la
cola de comandos: el clic del usuario **es** la confirmación. La cola
protege contra acciones iniciadas por el asistente.

## Multi-dispositivo

- **PWA**: manifest + service worker (shell offline; las APIs nunca se cachean).
- **iPhone**: instalable desde Safari; voz vía Web Speech API; Siri vía Shortcut.
- **Seguridad**: RLS por usuario, lock global por `ALLOWED_EMAIL`, API key
  con comparación de tiempo constante para Shortcuts, rate limiting por
  usuario/IP, y `security_logs` append-only (solo el servidor escribe).
