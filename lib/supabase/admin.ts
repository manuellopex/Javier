import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS — server-side only, never import from
 * client components. Used by the Apple Shortcuts endpoint (API-key auth,
 * no cookie session) and by the audit logger.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not configured');
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let cachedOwnerId: string | null = null;

/**
 * Resolves the owner's user id (single-user system) from ALLOWED_EMAIL.
 * Cached per server instance.
 */
export async function getOwnerUserId(): Promise<string | null> {
  if (cachedOwnerId) return cachedOwnerId;
  const email = process.env.ALLOWED_EMAIL?.toLowerCase();
  if (!email) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const owner = data.users.find((u) => u.email?.toLowerCase() === email);
  cachedOwnerId = owner?.id ?? null;
  return cachedOwnerId;
}
