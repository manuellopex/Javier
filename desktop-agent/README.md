# AURA Desktop Agent

Microservicio local **opcional** que corre en tu Mac o PC y permite a AURA ejecutar un conjunto pequeño y auditado de acciones locales.

Tiene dos modos que funcionan en paralelo:

1. **Modo local** — servidor HTTP en `127.0.0.1` para invocarlo directo (curl, scripts, Shortcuts en tu red).
2. **Modo conectado (Fase 4)** — el agente hace *polling saliente* al backend de AURA: recoge comandos que **tú ya aprobaste** en la UI, los ejecuta y reporta el resultado. Sin puertos abiertos, sin túneles, funciona detrás de NAT.

## Flujo conectado (Fase 4)

```
Chat → run_desktop_command (HIGH) → aprobación pendiente en Approvals
  → tú apruebas → status "approved"
  → el agente lo recoge en su siguiente poll (~7s)
  → ejecuta localmente (allowlist local — segunda capa)
  → reporta → status "executed"/"failed" + output visible en Approvals
```

Si el agente muere a mitad de una ejecución, el backend re-entrega el comando tras 2 minutos (claim TTL).

## Principios de seguridad

- **Allowlist, no blocklist**: solo existen 6 acciones; no hay forma de ejecutar comandos arbitrarios.
- **No hay acción de borrado.** El agente no puede eliminar archivos, punto.
- **Confinamiento de rutas**: las operaciones de archivos solo funcionan dentro de `allowedFolders`, con bloqueo adicional de rutas sensibles (`.ssh`, `.aws`, `/etc`, keychains…).
- **`run_command` solo ejecuta entradas con nombre** definidas en `config.json` (`allowedCommands`), nunca strings arbitrarios.
- **Doble capa**: el backend solo entrega comandos aprobados manualmente por ti, y el agente vuelve a validar contra su allowlist local. Un backend comprometido no puede saltarse la allowlist.
- **Solo conexiones salientes** en modo conectado; el servidor local solo escucha en `127.0.0.1`.
- **Todo queda registrado** en `agent.log` (JSON lines) y en el audit log del servidor.

## Acciones disponibles

| Acción | Parámetros | Descripción |
|---|---|---|
| `open_url` | `{url}` | Abre una URL http/https en el navegador |
| `open_app` | `{app}` | Abre una app de la allowlist |
| `create_text_file` | `{path, content}` | Crea un archivo de texto (nunca sobrescribe) |
| `read_folder` | `{path}` | Lista una carpeta permitida |
| `move_file` | `{from, to}` | Mueve archivos dentro de carpetas permitidas (nunca sobrescribe) |
| `run_command` | `{name}` | Ejecuta un comando pre-registrado por nombre |

## Instalación

```bash
cd desktop-agent
cp config.example.json config.json
npm start
```

Edita `config.json`:

- `apiKey` — string largo aleatorio para el modo local (`openssl rand -hex 32`).
- `allowedFolders`, `allowedApps`, `allowedCommands` — tus allowlists.
- **`backend`** (modo conectado):
  - `url` — tu despliegue de AURA (`https://tu-dominio.vercel.app`).
  - `agentKey` — debe coincidir con la variable `DESKTOP_AGENT_KEY` del servidor (genera otra: `openssl rand -hex 32`). Es una key distinta de `apiKey` y de `SHORTCUT_API_KEY`.
  - `pollSeconds` — frecuencia de polling (default 7).

Si no agregas el bloque `backend`, el agente corre solo en modo local como antes.

En el servidor (Vercel): añade `DESKTOP_AGENT_KEY` a las variables de entorno y redespliega. La tarjeta **Desktop Agent** en /integrations mostrará `online · <hostname>` cuando el agente esté reportando.

## Probarlo

1. Arranca el agente (`npm start`) — debe loguear `cloud_connector_started`.
2. En /integrations verifica el badge `online`.
3. En el chat: «abre example.com en mi computadora».
4. AURA encola la aprobación → apruébala en Approvals → en segundos el navegador de tu máquina abre la URL y el comando pasa a `executed`.

## Uso local directo (sin backend)

```bash
curl -s http://127.0.0.1:8787/action \
  -H 'content-type: application/json' \
  -H 'x-aura-key: TU_API_KEY' \
  -d '{"action":"open_url","params":{"url":"https://example.com"}}'
```

> Nunca expongas el puerto local a internet. El modo conectado no lo necesita: todo es saliente.
