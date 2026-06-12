# Integraciones (Fase 3) — Google Calendar, Email, CRM

Todo es opcional y se activa por variables de entorno. Sin configurar nada:
el calendario local funciona solo, los borradores de email funcionan (solo
no se pueden *enviar*), y el CRM no necesita nada externo.

## Calendario

### Cómo funciona

- Los eventos viven en la tabla `events` (calendario local) — cero configuración.
- Con **Google Calendar conectado**, `/calendar` y el asistente **mezclan** ambas fuentes, y los eventos nuevos se crean en Google (en tu calendario real).
- Riesgos: listar = LOW, crear = MEDIUM (directo + audit), **borrar = HIGH** → confirmación manual cuando lo pide el asistente.

### Conectar Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com) → crea un proyecto.
2. **APIs & Services → Library** → habilita **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: tipo *External*, agrega tu email como **test user** (suficiente para uso personal; no necesitas publicar la app).
4. **Credentials → Create credentials → OAuth client ID**:
   - Tipo: *Web application*.
   - **Authorized redirect URIs**: `https://TU-DOMINIO/api/integrations/google/callback`
     (y `http://localhost:3000/api/integrations/google/callback` para dev).
5. Copia el Client ID y Secret a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
6. En AURA: **Integrations → Connect Google Calendar** → consentimiento → listo.

Los tokens (refresh + access) se guardan en la tabla `integrations` protegida por RLS; el access token se renueva solo. **Disconnect** borra los tokens.

> Scope mínimo: `calendar.events` (no calendarios completos ni contactos).

## Email (Resend)

1. Crea cuenta en [resend.com](https://resend.com) y verifica tu dominio (o usa `onboarding@resend.dev` para pruebas).
2. Crea una API key → `RESEND_API_KEY`.
3. `EMAIL_FROM="AURA <aura@tudominio.com>"` (debe ser remitente verificado).

**Flujo de seguridad**: el asistente redacta libremente (LOW). Cuando le pides *enviar*, la herramienta `send_email` **no envía**: crea un comando HIGH con destinatario, asunto y cuerpo, que tú apruebas en **Commands** (o en la tarjeta del chat). Solo `/api/commands/confirm` ejecuta el envío. Si Resend no está configurado, el comando falla con un mensaje claro y queda auditado.

## CRM ligero

Tablas `clients` y `quotes` (sin servicios externos). Flujo típico:

1. «Agrega a Rob de Acme como lead» → `create_client`.
2. «Crea una cotización para Rob: rediseño de sitio web, $3,500 USD» → `create_quote` genera la cotización completa en markdown (alcance, entregables, términos, precio) como **draft**.
3. La revisas en **Clients** (expandir cliente → cotización → cambiar estado: draft/sent/accepted/rejected).
4. «Envíasela por email a rob@acme.com» → borrador del email + comando de envío con tu confirmación.

## Solución de problemas

| Síntoma | Causa |
|---|---|
| `google=error` al volver del consentimiento | Redirect URI no coincide exactamente, o Google no devolvió refresh token (revoca el acceso en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y reconecta) |
| Eventos de Google no aparecen | Token expirado/revocado — desconecta y reconecta; el calendario local sigue visible siempre |
| Comando send_email falla | `RESEND_API_KEY`/`EMAIL_FROM` sin configurar, o remitente no verificado en Resend |
