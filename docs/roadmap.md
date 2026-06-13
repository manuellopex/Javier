# Roadmap — próximos upgrades

## Sistema de agentes ✅ (ver docs/agents.md)
- [x] Registro modular de agentes (7 especializados + orquestador) sobre un solo motor con riesgo/aprobaciones/audit compartidos.
- [x] Workspaces: Content Lab, YouTube Research, Music Finder, Sales Desk, Production Hub, TTP Growth, Daily Brief, directorio /agents.
- [x] Tablas leads, projects, contents, content_metrics; tareas por proyecto; conversaciones por agente.
- [x] YouTube Data API + Spotify Web API conectadas (por env vars); métricas de Instagram manuales sobre la tabla definitiva.
- [ ] Instagram Graph API → alimentar content_metrics automáticamente.
- [ ] Spotify OAuth de usuario → crear playlists reales; bibliotecas licenciadas (Artlist/Epidemic).
- [ ] LaunchPass/Discord/Stripe → segmentos TTP automáticos (miembros, inactivos, pagos).
- [ ] Brief diario programado (cron) con push notification.

## Fase 2 — Voz avanzada ✅ (ver docs/voice.md)
- [x] STT externo (Deepgram / Groq Whisper) detrás de `services/stt.ts`, activado por env vars.
- [x] TTS de calidad (ElevenLabs, streaming desde el servidor) con fallback automático a `speechSynthesis`.
- [x] Modo manos libres: escuchar → enviar → hablar → volver a escuchar, con auto-apagado tras silencio.
- [x] Orbe reactivo al audio (WebAudio AnalyserNode) con estados listening/thinking/speaking.
- [ ] Pendiente fino: playback con MediaSource para latencia menor en respuestas largas; wake word.

## Fase 3 — Integraciones ✅ (ver docs/integrations.md)
- [x] Calendario: tabla `events` local + conector Google Calendar (OAuth, merge de fuentes); listar LOW, crear MEDIUM, borrar HIGH con confirmación.
- [x] Email vía Resend: borradores LOW, envío HIGH ejecutado únicamente desde `/api/commands/confirm`.
- [x] CRM ligero: tablas `clients` + `quotes`; cotizaciones en markdown generadas por el asistente, gestión de estados en la UI.
- [x] Vistas /calendar (agenda 14 días) y /clients; página Integrations dinámica con connect/disconnect de Google.
- [ ] Pendiente fino: sincronización bidireccional offline de Google (cache local), envío de cotizaciones como PDF adjunto.

## Fase 4 — Desktop Agent conectado ✅ (ver desktop-agent/README.md)
- [x] Modelo de polling saliente (sin túnel ni puertos abiertos): el agente recoge comandos aprobados y reporta resultados.
- [x] Tool `run_desktop_command` (HIGH): chat → aprobación manual → ejecución local con allowlist (doble capa) → output en Approvals.
- [x] Heartbeat del agente como `integration` (kind desktop_agent); badge online/offline en /integrations.
- [x] Re-entrega con claim TTL (2 min) si el agente muere a mitad de ejecución.
- [ ] Pendiente fino: empujar el resultado de vuelta a la conversación del chat; múltiples agentes (varias máquinas) con id por host.

## Fase 5 — Automatizaciones
- [ ] Workflows: triggers (cron, evento) → pasos (tools) → confirmaciones.
- [ ] Resumen diario automático (tareas + calendario) vía push/email matutino.
- [ ] Web push notifications para `action_required`.

## Fase 6 — UI cinematográfica
- [ ] Orbe 3D reactivo (Three.js) como presencia del asistente.
- [ ] Temas personalizables y modo enfoque.
- [ ] Atajos de teclado globales (cmd+K command palette).

## Deuda técnica / hardening
- [ ] Rate limiting durable (Upstash Redis) en lugar de in-memory.
- [ ] Tests: unit (risk policy, rate limit) + integración (rutas API con Supabase local).
- [ ] Búsqueda semántica en memorias (pgvector + embeddings) en lugar de ILIKE.
- [ ] Compactación de conversaciones largas (la API de Anthropic soporta compaction server-side).
- [ ] Expiración automática de comandos `pending` viejos (cron).
- [ ] Títulos de conversación generados por el modelo.
