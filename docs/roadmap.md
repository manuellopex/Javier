# Roadmap — próximos upgrades

## Fase 2 — Voz avanzada
- [ ] STT externo (Deepgram / Groq Whisper) detrás de `services/stt.ts` (la interfaz ya existe; `/api/transcribe` lo activa solo).
- [ ] TTS de calidad (ElevenLabs) con streaming de audio, reemplazando `speechSynthesis`.
- [ ] Modo manos libres: escucha continua + auto-envío.
- [ ] Visualización de audio reactiva en el orbe del chat.

## Fase 3 — Integraciones
- [ ] Calendario (Google Calendar / CalDAV): lectura LOW, escritura HIGH con confirmación.
- [ ] Email (Gmail API / Resend): borradores LOW, envío HIGH — el ejecutor ya tiene su lugar en `/api/commands/confirm`.
- [ ] CRM ligero: tabla `clients` + cotizaciones generadas por el asistente.
- [ ] Vista /calendar en la UI.

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
