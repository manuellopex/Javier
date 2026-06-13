# Supabase — configuración

## 1. Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre (`aura`), contraseña de base de datos y región cercana.

## 2. Crear el esquema

1. En el dashboard: **SQL Editor** → **New query**.
2. Pega el contenido completo de [`db/schema.sql`](../db/schema.sql) y ejecuta (**Run**).
3. Verifica en **Table Editor** que existen: `conversations`, `messages`, `tasks`, `memories`, `commands`, `integrations`, `security_logs`.

Todas las tablas tienen **Row Level Security**: cada fila pertenece a su usuario. La service-role key (solo servidor) se usa para el endpoint de Shortcuts y los logs de auditoría.

## 3. Crear tu usuario (único)

El registro público está deshabilitado a propósito.

1. **Authentication → Users → Add user → Create new user**.
2. Email: el mismo que pondrás en `ALLOWED_EMAIL`. Marca **Auto Confirm User**.
3. (Recomendado) **Authentication → Sign In / Up**: desactiva **Allow new users to sign up**.

## 4. Copiar las llaves

**Project Settings → API**:

| Variable | Dónde está |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (⚠️ solo servidor, nunca en frontend) |

Ponlas en `.env.local` (local) y en las Environment Variables de Vercel (producción).
