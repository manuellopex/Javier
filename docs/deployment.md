# Despliegue en Vercel

## 1. Preparación

- Repo en GitHub con este código.
- Proyecto Supabase configurado ([supabase-setup.md](./supabase-setup.md)).
- API key de Anthropic ([console.anthropic.com](https://console.anthropic.com)).

## 2. Importar en Vercel

1. [vercel.com/new](https://vercel.com/new) → importa el repositorio.
2. Framework: **Next.js** (autodetectado). Build settings por defecto.
3. **Environment Variables** — añade todas las de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_EMAIL`
   - `ANTHROPIC_API_KEY`
   - `SHORTCUT_API_KEY` (genera: `openssl rand -hex 32`)
4. **Deploy**.

## 3. Después del deploy

1. Abre la URL → `/login` → entra con tu usuario de Supabase.
2. Prueba el chat: «Recuérdame revisar el deploy mañana».
3. **Instala la PWA**:
   - iPhone: Safari → Compartir → *Agregar a pantalla de inicio*.
   - Desktop: icono de instalación en Chrome/Edge.
4. Configura el Shortcut ([apple-shortcuts.md](./apple-shortcuts.md)).

## Notas

- `/api/chat` declara `maxDuration = 120`; en el plan Hobby de Vercel el límite efectivo puede ser menor — si ves cortes en respuestas largas, sube de plan o reduce `MAX_TOOL_ROUNDS`.
- El rate limiting es in-memory (best-effort en serverless). Para límites duros usa Upstash Redis (ver roadmap).
- Dominio propio: Settings → Domains. La PWA y el Shortcut deben apuntar al dominio final.

## Correr local

```bash
cp .env.example .env.local   # rellena los valores
npm install
npm run dev                  # http://localhost:3000
```

Para probar la PWA y la voz en iPhone contra tu máquina local necesitas HTTPS — lo más simple es desplegar a Vercel y probar ahí.
