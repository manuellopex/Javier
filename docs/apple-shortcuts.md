# Apple Shortcuts — conectar AURA a tu iPhone

Con un Shortcut puedes hablarle a AURA desde Siri, el **botón de acción**, un widget o la app Atajos: dictas → se envía a tu endpoint → recibes/escuchas la respuesta.

## Requisitos

1. AURA desplegada (p. ej. `https://aura.tudominio.com`).
2. `SHORTCUT_API_KEY` configurada en el servidor (genera una: `openssl rand -hex 32`).
3. `ALLOWED_EMAIL` configurado y tu usuario creado en Supabase (el endpoint actúa en nombre de ese usuario).

## El endpoint

```
POST https://TU-DOMINIO/api/shortcut/command
Content-Type: application/json
x-aura-key: TU_SHORTCUT_API_KEY
```

**Payload de ejemplo:**

```json
{
  "text": "Recuérdame llamar a Rob mañana a las 10"
}
```

**Respuesta:**

```json
{
  "reply": "Listo. Tarea creada: llamar a Rob, mañana 10:00."
}
```

> También puedes mandar la key en el body como `"key": "..."` si prefieres no usar headers, pero el header es lo recomendado.

## Configurar el Shortcut paso a paso

1. Abre **Atajos** → **+** para crear uno nuevo. Nómbralo `AURA`.
2. Añade la acción **“Dictar texto”** (Dictate Text). Idioma: Español.
3. Añade **“Obtener contenido de URL”** (Get Contents of URL) y configúrala:
   - **URL**: `https://TU-DOMINIO/api/shortcut/command`
   - **Método**: `POST`
   - **Encabezados** (Headers): añade `x-aura-key` → tu API key.
   - **Cuerpo de la solicitud** (Request Body): `JSON`, con un campo:
     - `text` → la variable **Texto dictado** (Dictated Text).
4. Añade **“Obtener valor de diccionario”** (Get Dictionary Value):
   - Get **Value** for `reply` in **Contents of URL**.
5. Añade la salida que prefieras:
   - **“Mostrar resultado”** (Show Result) → muestra la respuesta, o
   - **“Leer texto en voz alta”** (Speak Text) → Siri lee la respuesta.

## Activarlo

- **Siri**: di “Oye Siri, AURA”.
- **Botón de acción** (iPhone 15 Pro+): Ajustes → Botón de acción → Atajo → AURA.
- **Widget**: añade el widget de Atajos a tu pantalla de inicio.

## Seguridad

- La API key es **personal**: cualquiera que la tenga puede mandar comandos. Guárdala solo en el Shortcut.
- El endpoint tiene rate limiting (20 req/min por IP) y registra intentos fallidos de autenticación en el log de auditoría.
- Si la key se filtra, cámbiala en las variables de entorno y redespliega.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `401 Unauthorized` | Key incorrecta o header mal escrito (`x-aura-key`) |
| `503 Shortcut endpoint not configured` | Falta `SHORTCUT_API_KEY` en el servidor |
| `503 Owner account not found` | Falta `ALLOWED_EMAIL` o el usuario no existe en Supabase |
| `429` | Rate limit — espera un minuto |
