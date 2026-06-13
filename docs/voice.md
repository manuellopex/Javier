# Voz — arquitectura y configuración (Fase 2)

La voz de AURA funciona en capas: **siempre hay un camino que funciona sin configurar nada** (el navegador), y los proveedores externos mejoran calidad cuando agregas sus keys.

## Entrada de voz (STT)

```
Micrófono
  │
  ├─ 1. Web Speech API (SpeechRecognition)      ← por defecto, gratis, en vivo
  │     Safari (incl. iPhone), Chrome, Edge
  │
  └─ 2. Fallback: MediaRecorder → POST /api/transcribe
        │
        └─ services/stt.ts → proveedor configurado:
             · Deepgram (nova-2)        STT_PROVIDER=deepgram + DEEPGRAM_API_KEY
             · Groq Whisper large v3    STT_PROVIDER=groq     + GROQ_API_KEY
```

- Si no hay proveedor configurado, `/api/transcribe` responde 501 con instrucciones; el camino 1 no se ve afectado.
- El idioma se toma de Settings (`aura:lang`) y se envía como hint al proveedor.
- Si `STT_PROVIDER` no está definido, gana el primer proveedor con key presente.

## Respuestas habladas (TTS)

```
Respuesta del asistente
  │
  ├─ 1. POST /api/tts → services/tts.ts → ElevenLabs (streaming mp3)
  │     ELEVENLABS_API_KEY [+ ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL]
  │
  └─ 2. Fallback automático: speechSynthesis del navegador
        (cuando /api/tts devuelve 501, falla, o el autoplay está bloqueado)
```

- El servidor limpia markdown y recorta a 2000 caracteres antes de sintetizar (costo).
- Voz por defecto: *Rachel* (`21m00Tcm4TlvDq8ikWAM`); pon tu propia voz clonada en `ELEVENLABS_VOICE_ID`.
- Settings muestra qué proveedor está activo (badges en la sección Voice).

## Modo manos libres

Toggle **◉ Hands-free** en el chat. El ciclo:

```
escuchar → transcribir → enviar → AURA responde (stream) → hablar → volver a escuchar
```

- Auto-envío: lo que dictes se manda sin tocar nada.
- Tras **2 rondas seguidas en silencio**, el modo se apaga solo (batería/privacidad).
- El **orbe reactivo** muestra el estado: escala con el nivel real del micrófono (WebAudio AnalyserNode) al escuchar, anillo girando al pensar, pulso al hablar. Si el navegador no permite abrir el analizador junto al reconocimiento, cae a la animación CSS sin romper nada.
- Salir: botón *Exit* en el orbe o el mismo toggle.

## Limitaciones conocidas

- **iOS + autoplay**: Safari puede bloquear la reproducción de audio que no sigue inmediatamente a un gesto del usuario. Si pasa, el cliente cae a `speechSynthesis` automáticamente. En la práctica, iniciar manos libres con un tap mantiene la sesión "activada" la mayoría de las veces.
- **Reconocimiento continuo**: usamos sesiones cortas de reconocimiento reiniciadas entre turnos (más fiable cross-browser que `continuous: true`, especialmente en iOS).
- **Costo**: cada respuesta hablada con ElevenLabs consume cuota; el toggle de TTS en Settings y el recorte a 2000 chars lo acotan.

## Próximos pasos (ver roadmap)

- Streaming de audio TTS real al cliente (MediaSource/ManagedMediaSource) para bajar latencia en respuestas largas.
- Wake word / push-to-talk con el botón de acción del iPhone vía Shortcut.
