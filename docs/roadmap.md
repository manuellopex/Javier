# Roadmap — próximos upgrades

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

## Fase 4 — Desktop Agent conectado
- [ ] Registro del agente como `integration` (URL del túnel + key).
- [ ] Tool `run_desktop_command` en el backend (ya clasificado HIGH) → ejecuta vía agente tras confirmación.
- [ ] Túnel seguro recomendado: Tailscale.

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
