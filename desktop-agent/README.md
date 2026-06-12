# AURA Desktop Agent

Microservicio local **opcional** que corre en tu Mac o PC y permite a AURA ejecutar un conjunto pequeño y auditado de acciones locales.

## Principios de seguridad

- **Allowlist, no blocklist**: solo existen 6 acciones; no hay forma de ejecutar comandos arbitrarios.
- **No hay acción de borrado.** El agente no puede eliminar archivos, punto.
- **Confinamiento de rutas**: las operaciones de archivos solo funcionan dentro de `allowedFolders`, con bloqueo adicional de rutas sensibles (`.ssh`, `.aws`, `/etc`, keychains…).
- **`run_command` solo ejecuta entradas con nombre** definidas en `config.json` (`allowedCommands`), nunca strings arbitrarios.
- **Solo escucha en `127.0.0.1`** y requiere API key (comparación de tiempo constante).
- **Todo queda registrado** en `agent.log` (JSON lines).

## Acciones disponibles

| Acción | Descripción |
|---|---|
| `open_url` | Abre una URL http/https en el navegador |
| `open_app` | Abre una app de la allowlist |
| `create_text_file` | Crea un archivo de texto (nunca sobrescribe) |
| `read_folder` | Lista una carpeta permitida |
| `move_file` | Mueve archivos dentro de carpetas permitidas (nunca sobrescribe) |
| `run_command` | Ejecuta un comando pre-registrado por nombre |

## Instalación

```bash
cd desktop-agent
cp config.example.json config.json
# Edita config.json: apiKey (string largo aleatorio), allowedFolders, allowedApps
npm start
```

## Uso

```bash
curl -s http://127.0.0.1:8787/action \
  -H 'content-type: application/json' \
  -H 'x-aura-key: TU_API_KEY' \
  -d '{"action":"open_url","params":{"url":"https://example.com"}}'
```

## Conexión con AURA (Fase 4)

En la Fase 4 el backend de AURA enviará acciones al agente **siempre tras confirmación manual** (las acciones de escritorio son riesgo HIGH). Mientras tanto puedes invocarlo directamente o desde Apple Shortcuts en tu red local.

> Nunca expongas este puerto a internet. Si necesitas acceso remoto, usa un túnel autenticado (Tailscale) — nunca un port-forward abierto.
